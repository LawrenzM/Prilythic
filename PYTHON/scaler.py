import os
import pandas as pd
from sklearn.preprocessing import StandardScaler
import joblib
import numpy as np

# --- Base paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "PHL_RTFP_mkt_2007_2025-09-23.csv")  # change if needed
SCALER_DIR = os.path.join(BASE_DIR, "scalers")
os.makedirs(SCALER_DIR, exist_ok=True)
SCALER_PATH = os.path.join(SCALER_DIR, "scaler.pkl")

# --- Load CSV ---
df = pd.read_csv(DATA_PATH)

# Convert price_date properly (dayfirst=True if format is DD/MM/YYYY)
df['price_date'] = pd.to_datetime(df['price_date'], dayfirst=True)

# --- Clean product columns ---
product_cols = [col for col in df.columns if col.startswith('c_')]
for col in product_cols:
    df[col] = pd.to_numeric(df[col], errors='coerce')  # convert '-' or other strings to NaN

# Drop rows with NaNs in any product columns for scaler fitting
df_clean = df.dropna(subset=product_cols).reset_index(drop=True)

# --- Prepare features ---
feature_rows = []
for i in range(2, len(df_clean)):
    for product in product_cols:
        row = {}
        row['year'] = df_clean['price_date'].iloc[i].year
        row['month'] = df_clean['price_date'].iloc[i].month
        row['dayofweek'] = df_clean['price_date'].iloc[i].dayofweek
        row['price_lag1'] = df_clean[product].iloc[i-1]
        row['price_lag2'] = df_clean[product].iloc[i-2]

        # One-hot encode product columns
        for p in product_cols:
            row[f'product_{p.replace("c_", "")}'] = 1 if p == product else 0

        feature_rows.append(row.copy())

X = pd.DataFrame(feature_rows)

# --- Fit scaler ---
scaler = StandardScaler()
scaler.fit(X)

# --- Save scaler ---
joblib.dump(scaler, SCALER_PATH)
print(f"Scaler saved at: {SCALER_PATH}")
print("Scaler input features:")
print(scaler.feature_names_in_)
