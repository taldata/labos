from dash import Dash, html, dcc, Input, Output
import dash_bootstrap_components as dbc
import plotly.express as px
import plotly.graph_objects as go
from flask_login import login_required
import pandas as pd
from sqlalchemy import func
from datetime import datetime, timedelta
from models import Expense, Department, Category, User, db

def create_admin_dashboard(server):
    # Create a Dash app
    dash_app = Dash(
        __name__,
        server=server,
        url_base_pathname='/admin/dashboard/',
        external_stylesheets=[dbc.themes.BOOTSTRAP]
    )

    # Layout
    dash_app.layout = dbc.Container([
        dbc.Row([
            dbc.Col(html.H1("Admin Dashboard", className="text-center mb-4"), width=12)
        ]),
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader("Total Expenses Overview"),
                    dbc.CardBody([
                        dcc.Graph(id='total-expenses-chart')
                    ])
                ], className="mb-4")
            ], width=6),
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader("Department Budget Usage"),
                    dbc.CardBody([
                        dcc.Graph(id='department-budget-chart')
                    ])
                ], className="mb-4")
            ], width=6)
        ]),
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader("Expense Status Distribution"),
                    dbc.CardBody([
                        dcc.Graph(id='expense-status-chart')
                    ])
                ])
            ], width=6),
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader("Top Spenders"),
                    dbc.CardBody([
                        dcc.Graph(id='top-spenders-chart')
                    ])
                ])
            ], width=6)
        ])
    ], fluid=True)

    @dash_app.callback(
        Output('total-expenses-chart', 'figure'),
        Input('total-expenses-chart', 'id')
    )
    def update_total_expenses():
        # Get expenses for the last 6 months
        end_date = datetime.now()
        start_date = end_date - timedelta(days=180)
        
        expenses = db.session.query(
            func.date_trunc('month', Expense.date).label('month'),
            func.sum(Expense.amount).label('total')
        ).filter(
            Expense.date >= start_date,
            Expense.date <= end_date
        ).group_by(
            func.date_trunc('month', Expense.date)
        ).all()
        
        df = pd.DataFrame(expenses, columns=['month', 'total'])
        
        fig = px.line(df, x='month', y='total',
                     title='Total Expenses Over Time',
                     labels={'total': 'Total Amount (₪)', 'month': 'Month'})
        return fig

    @dash_app.callback(
        Output('department-budget-chart', 'figure'),
        Input('department-budget-chart', 'id')
    )
    def update_department_budget():
        # Get department budgets and their usage
        departments = Department.query.all()
        dept_data = []
        
        for dept in departments:
            total_expenses = db.session.query(func.sum(Expense.amount))\
                .join(Category)\
                .filter(Category.department_id == dept.id)\
                .scalar() or 0
                
            usage_percent = (total_expenses / dept.budget * 100) if dept.budget > 0 else 0
            dept_data.append({
                'Department': dept.name,
                'Budget Usage (%)': usage_percent
            })
        
        df = pd.DataFrame(dept_data)
        
        fig = px.bar(df, x='Department', y='Budget Usage (%)',
                    title='Department Budget Usage',
                    labels={'Budget Usage (%)': 'Budget Usage (%)'})
        return fig

    @dash_app.callback(
        Output('expense-status-chart', 'figure'),
        Input('expense-status-chart', 'id')
    )
    def update_expense_status():
        # Get expense status distribution
        status_counts = db.session.query(
            Expense.status,
            func.count(Expense.id)
        ).group_by(Expense.status).all()
        
        df = pd.DataFrame(status_counts, columns=['Status', 'Count'])
        
        fig = px.pie(df, values='Count', names='Status',
                    title='Expense Status Distribution')
        return fig

    @dash_app.callback(
        Output('top-spenders-chart', 'figure'),
        Input('top-spenders-chart', 'id')
    )
    def update_top_spenders():
        # Get top 10 spenders
        top_spenders = db.session.query(
            User.username,
            func.sum(Expense.amount).label('total')
        ).join(Expense)\
        .group_by(User.username)\
        .order_by(func.sum(Expense.amount).desc())\
        .limit(10).all()
        
        df = pd.DataFrame(top_spenders, columns=['User', 'Total Spent'])
        
        fig = px.bar(df, x='User', y='Total Spent',
                    title='Top 10 Spenders',
                    labels={'Total Spent': 'Total Amount (₪)'})
        return fig

    # Protect all Dash views with Flask-Login
    for view_function in dash_app.server.view_functions:
        if view_function.startswith(dash_app.config.url_base_pathname):
            dash_app.server.view_functions[view_function] = login_required(
                dash_app.server.view_functions[view_function]
            )

    return dash_app 