import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV, RandomizedSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
import joblib
from sklearn.metrics import mean_absolute_error, make_scorer

# Load Data
script_dir = os.path.dirname(os.path.abspath(__file__))
details_path = os.path.join(script_dir, "PHL_RTFP_mkt_2007_2025-09-23.csv")
ticker_path = os.path.join(script_dir, "PHL_RTP_ticker_info_2007_2025-09-23.csv")

# Check if files exist
if not os.path.exists(details_path):
    raise FileNotFoundError(f"The file {details_path} does not exist.")
if not os.path.exists(ticker_path):
    raise FileNotFoundError(f"The file {ticker_path} does not exist.")

# Load Data
df_details = pd.read_csv(details_path)
df_ticker = pd.read_csv(ticker_path)

# Merge ticker info if exists
if "components" in df_details.columns:
    df = df_details.merge(
        df_ticker[["ticker", "full_name", "units"]],
        how="left",
        left_on="components",
        right_on="ticker"
    )
else:
    df = df_details.copy()

# Reshape Wide → Long
product_cols = [
    "beans", "cabbage", "carrots", "eggs",
    "meat_beef_chops", "meat_chicken_whole", "meat_pork",
    "onions", "potatoes", "rice", "tomatoes"
]
df_long = df.melt(
    id_vars=["ISO3", "country", "adm1_name", "adm2_name", "mkt_name", "lat", "lon", "price_date"],
    value_vars=product_cols,
    var_name="product",
    value_name="price"
)

# Drop missing values
df_long = df_long.dropna(subset=["price"])
df_long["price_date"] = pd.to_datetime(df_long["price_date"], errors="coerce")
df_long = df_long.sort_values("price_date")

# Feature Engineering: Add temporal and lag features
df_long["year"] = df_long["price_date"].dt.year
df_long["month"] = df_long["price_date"].dt.month
df_long["dayofweek"] = df_long["price_date"].dt.dayofweek

# Create lag features
df_long = df_long.sort_values(["product", "mkt_name", "price_date"])
df_long["price_lag1"] = df_long.groupby(["product", "mkt_name"])["price"].shift(1)
df_long["price_lag2"] = df_long.groupby(["product", "mkt_name"])["price"].shift(2)

# One-hot encode product
df_long = pd.get_dummies(df_long, columns=["product"], drop_first=True)

# Drop extra columns
drop_cols = [
    "ISO3", "country", "adm1_name", "adm2_name", "mkt_name",
    "lat", "lon", "price_date"
]
df_long = df_long.drop(columns=drop_cols, errors="ignore")

# Impute missing lag values
imputer = SimpleImputer(strategy="mean")
df_long[df_long.columns] = imputer.fit_transform(df_long)

# Features & target split
y = df_long["price"]
X = df_long.drop(columns=["price"])

# Scale features
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Train/Test split (chronologically)
split_idx = int(len(X_scaled) * 0.8)
X_train, X_test = X_scaled[:split_idx], X_scaled[split_idx:]
y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

# Define the parameter grid for Random Forest
rf_params = {
    'n_estimators': [100, 200, 300],
    'max_depth': [None, 10, 20, 30],
    'min_samples_split': [2, 5, 10],
    'min_samples_leaf': [1, 2, 4],
    'bootstrap': [True, False],
    'max_features': ['auto', 'sqrt']
}

# Create the Random Forest model
rf = RandomForestRegressor(random_state=42)

# Use GridSearchCV for hyperparameter tuning
grid_rf = GridSearchCV(rf, param_grid=rf_params, cv=5, scoring='neg_mean_absolute_error', n_jobs=-1, verbose=2)
grid_rf.fit(X_train, y_train)

# Get the best model
best_rf_model = grid_rf.best_estimator_

# Evaluate the best model
best_score = grid_rf.best_score_
print(f"Best Model Score: {best_score}")
print(f"Best Model Parameters: {grid_rf.best_params_}")

# Save the model and scaler
model_path = os.path.join(script_dir, "optimized_random_forest_model.pkl")
scaler_path = os.path.join(script_dir, "scaler.pkl")
joblib.dump(best_rf_model, model_path)
joblib.dump(scaler, scaler_path)

print("Optimized Random Forest model and scaler saved successfully.")
print("Model saved at:", model_path)
print("Scaler saved at:", scaler_path)
