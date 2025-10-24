import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
import joblib
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Load Data
script_dir = os.path.dirname(os.path.abspath(__file__))
details_path = os.path.join(script_dir, "MAINDATA.csv")
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
    "c_beans", "c_cabbage", "c_carrots", "c_eggs",
    "c_meat_beef_chops", "c_meat_chicken_whole", "c_meat_pork",
    "c_onions", "c_potatoes", "c_rice", "c_tomatoes",
    "c_dish_soap", "c_soap", "c_shampoo", "c_bleach", 
    "c_detergent", "c_fabric_softeners", "c_toothpaste", "c_deodorant", 
    "c_toilet_paper"
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
df_long["price_lag3"] = df_long.groupby(["product", "mkt_name"])["price"].shift(3)
df_long["price_lag4"] = df_long.groupby(["product", "mkt_name"])["price"].shift(4)
df_long["price_lag5"] = df_long.groupby(["product", "mkt_name"])["price"].shift(5)
df_long["price_lag6"] = df_long.groupby(["product", "mkt_name"])["price"].shift(6)
df_long["price_lag7"] = df_long.groupby(["product", "mkt_name"])["price"].shift(7)
df_long["price_lag8"] = df_long.groupby(["product", "mkt_name"])["price"].shift(8)
df_long["price_lag9"] = df_long.groupby(["product", "mkt_name"])["price"].shift(9)
df_long["price_lag10"] = df_long.groupby(["product", "mkt_name"])["price"].shift(10)
df_long["price_lag11"] = df_long.groupby(["product", "mkt_name"])["price"].shift(11)
df_long["price_lag12"] = df_long.groupby(["product", "mkt_name"])["price"].shift(12)

df_long["price_roll6"] = df_long.groupby(["product", "mkt_name"])["price"].transform(lambda x: x.rolling(6, min_periods=1).mean())

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

# --- SIMPLIFIED: Use optimized Random Forest without tuning ---
print("Training Random Forest with optimized parameters...")

# Create and train Random Forest with optimized defaults
rf_model = RandomForestRegressor(
    n_estimators=200,          
    max_depth=20,              
    min_samples_split=5,        
    min_samples_leaf=2,         
    random_state=42,
    n_jobs=-1
)

rf_model.fit(X_train, y_train)

# Make predictions
y_pred = rf_model.predict(X_test)

# --- COMPREHENSIVE EVALUATION ---
print("\n" + "="*50)
print("MODEL EVALUATION (No Hyperparameter Tuning)")
print("="*50)

# Calculate all metrics
mse = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)
mape = np.mean(np.abs((y_test - y_pred) / y_test)) * 100
max_error = np.max(np.abs(y_test - y_pred))

# Print metrics
print(f"Mean Squared Error (MSE): {mse:.4f}")
print(f"Root Mean Squared Error (RMSE): {rmse:.4f}")
print(f"Mean Absolute Error (MAE): {mae:.4f}")
print(f"R-squared (R²): {r2:.4f}")
print(f"Mean Absolute Percentage Error (MAPE): {mape:.2f}%")
print(f"Maximum Error: {max_error:.4f}")

# Price distribution context
avg_price = y_train.mean()
print(f"\nAverage Price: ${avg_price:.2f}")
print(f"MAE as % of average price: {(mae/avg_price)*100:.1f}%")

# Interpretation
if (mae/avg_price)*100 < 10:
    assessment = "✅ EXCELLENT"
elif (mae/avg_price)*100 < 20:
    assessment = "✅ GOOD"
elif (mae/avg_price)*100 < 30:
    assessment = "⚠️ ACCEPTABLE"
else:
    assessment = "❌ POOR - NEEDS IMPROVEMENT"

print(f"ASSESSMENT: {assessment}")

# Save the model and scaler
model_path = os.path.join(script_dir, "orfm4.pkl")
scaler_path = os.path.join(script_dir, "s4.pkl")
joblib.dump(rf_model, model_path)
joblib.dump(scaler, scaler_path)

print("\n" + "="*50)
print("MODEL SAVED SUCCESSFULLY")
print("="*50)
print("Model saved at:", model_path)
print("Scaler saved at:", scaler_path)