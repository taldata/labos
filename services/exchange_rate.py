import logging
import requests
from datetime import date, timedelta
from models import db, ExchangeRateCache

logger = logging.getLogger(__name__)

# Fallback rates in case all APIs fail
FALLBACK_RATES = {
    'USD': 3.65,
    'EUR': 3.95,
    'ILS': 1.0,
}


def get_exchange_rate(currency: str, target_date: date) -> float:
    """
    Get exchange rate from currency to ILS for the given date.
    Returns the rate (e.g., USD -> 3.65 means 1 USD = 3.65 ILS).
    """
    if currency == 'ILS':
        return 1.0

    # Check cache first
    cached = ExchangeRateCache.query.filter_by(currency=currency, date=target_date).first()
    if cached:
        return cached.rate_to_ils

    # Try fetching from Bank of Israel API
    rate = _fetch_from_boi(currency, target_date)

    # Fallback to exchangerate-api
    if rate is None:
        rate = _fetch_from_exchangerate_api(currency)

    # Last resort: use hardcoded fallback
    if rate is None:
        rate = FALLBACK_RATES.get(currency)
        if rate is None:
            logger.error(f"No exchange rate available for {currency}")
            raise ValueError(f"Unsupported currency: {currency}")
        logger.warning(f"Using fallback rate for {currency}: {rate}")

    # Cache the result
    try:
        cached_rate = ExchangeRateCache(
            currency=currency,
            date=target_date,
            rate_to_ils=rate
        )
        db.session.add(cached_rate)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.warning(f"Failed to cache exchange rate: {e}")

    return rate


def _fetch_from_boi(currency: str, target_date: date) -> float | None:
    """Fetch exchange rate from Bank of Israel SDMX API."""
    try:
        # BOI uses currency codes like USD, EUR
        # Try a range of dates (the target date may be a weekend/holiday)
        start = target_date - timedelta(days=7)
        end = target_date

        url = (
            f"https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI/EXR/1.0/"
            f"?startperiod={start.isoformat()}&endperiod={end.isoformat()}"
            f"&c[CURRENCY]={currency}&format=sdmx-json"
        )

        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            logger.warning(f"BOI API returned status {response.status_code}")
            return None

        data = response.json()

        # Navigate SDMX-JSON structure to get the latest observation
        datasets = data.get('data', {}).get('dataSets', [])
        if not datasets:
            return None

        observations = datasets[0].get('series', {})
        if not observations:
            return None

        # Get the first series and its observations
        first_series = next(iter(observations.values()), {})
        obs = first_series.get('observations', {})
        if not obs:
            return None

        # Get the latest observation (highest key = most recent date)
        latest_key = max(obs.keys(), key=int)
        rate = obs[latest_key][0]

        if rate and rate > 0:
            logger.info(f"BOI rate for {currency} on {target_date}: {rate}")
            return float(rate)

        return None

    except Exception as e:
        logger.warning(f"Failed to fetch from BOI API: {e}")
        return None


def _fetch_from_exchangerate_api(currency: str) -> float | None:
    """Fetch current exchange rate from exchangerate-api.com (free tier)."""
    try:
        url = f"https://open.er-api.com/v6/latest/{currency}"
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return None

        data = response.json()
        if data.get('result') != 'success':
            return None

        ils_rate = data.get('rates', {}).get('ILS')
        if ils_rate and ils_rate > 0:
            logger.info(f"exchangerate-api rate for {currency}: {ils_rate}")
            return float(ils_rate)

        return None

    except Exception as e:
        logger.warning(f"Failed to fetch from exchangerate-api: {e}")
        return None
