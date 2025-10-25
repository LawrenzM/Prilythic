import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
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

# Feature Importance (Top 10)
feature_importance = pd.DataFrame({
    'feature': X.columns,
    'importance': rf_model.feature_importances_
}).sort_values('importance', ascending=False)

print(f"\nTop 10 Most Important Features:")
print(feature_importance.head(10).to_string(index=False))

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

# Add this after your model evaluation metrics

# --- VISUALIZATION OF EVALUATION RESULTS ---
print("\n" + "="*50)
print("GENERATING EVALUATION GRAPHS")
print("="*50)

# Create visualization directory if it doesn't exist
viz_dir = os.path.join(script_dir, "model_evaluation")
os.makedirs(viz_dir, exist_ok=True)

# 1. Actual vs Predicted Scatter Plot
plt.figure(figsize=(10, 6))
plt.scatter(y_test, y_pred, alpha=0.6, color='blue')
plt.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--', lw=2)
plt.xlabel('Actual Prices')
plt.ylabel('Predicted Prices')
plt.title('Actual vs Predicted Prices')
plt.grid(True, alpha=0.3)
plt.savefig(os.path.join(viz_dir, 'actual_vs_predicted.png'), dpi=300, bbox_inches='tight')
plt.close()

# 2. Residuals Plot
residuals = y_test - y_pred
plt.figure(figsize=(10, 6))
plt.scatter(y_pred, residuals, alpha=0.6, color='green')
plt.axhline(y=0, color='r', linestyle='--')
plt.xlabel('Predicted Prices')
plt.ylabel('Residuals')
plt.title('Residuals vs Predicted Prices')
plt.grid(True, alpha=0.3)
plt.savefig(os.path.join(viz_dir, 'residuals_plot.png'), dpi=300, bbox_inches='tight')
plt.close()

# 3. Error Distribution
plt.figure(figsize=(10, 6))
plt.hist(residuals, bins=50, alpha=0.7, color='orange', edgecolor='black')
plt.xlabel('Prediction Error')
plt.ylabel('Frequency')
plt.title('Distribution of Prediction Errors')
plt.axvline(x=0, color='r', linestyle='--', label='Zero Error')
plt.legend()
plt.grid(True, alpha=0.3)
plt.savefig(os.path.join(viz_dir, 'error_distribution.png'), dpi=300, bbox_inches='tight')
plt.close()

# 4. Feature Importance Plot (Top 15)
plt.figure(figsize=(12, 8))
top_features = feature_importance.head(15)
plt.barh(top_features['feature'], top_features['importance'], color='skyblue')
plt.xlabel('Feature Importance')
plt.title('Top 15 Most Important Features')
plt.gca().invert_yaxis()
plt.grid(True, alpha=0.3)
plt.savefig(os.path.join(viz_dir, 'feature_importance.png'), dpi=300, bbox_inches='tight')
plt.close()

# 5. Metrics Comparison (if you want to compare multiple models)
metrics = ['MSE', 'RMSE', 'MAE', 'R²']
values = [mse, rmse, mae, r2]

plt.figure(figsize=(10, 6))
bars = plt.bar(metrics, values, color=['#ff9999', '#66b3ff', '#99ff99', '#ffcc99'])
plt.ylabel('Score')
plt.title('Model Evaluation Metrics')
plt.ylim(0, max(values) * 1.1)

# Add value labels on bars
for bar, value in zip(bars, values):
    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01, 
             f'{value:.3f}', ha='center', va='bottom')

plt.grid(True, alpha=0.3)
plt.savefig(os.path.join(viz_dir, 'metrics_comparison.png'), dpi=300, bbox_inches='tight')
plt.close()

# 6. Price Distribution vs Predictions
plt.figure(figsize=(12, 6))
plt.subplot(1, 2, 1)
plt.hist(y_test, bins=50, alpha=0.7, color='blue', label='Actual', edgecolor='black')
plt.xlabel('Price')
plt.ylabel('Frequency')
plt.title('Actual Price Distribution')
plt.grid(True, alpha=0.3)

plt.subplot(1, 2, 2)
plt.hist(y_pred, bins=50, alpha=0.7, color='red', label='Predicted', edgecolor='black')
plt.xlabel('Price')
plt.ylabel('Frequency')
plt.title('Predicted Price Distribution')
plt.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(viz_dir, 'price_distributions.png'), dpi=300, bbox_inches='tight')
plt.close()

print("✅ Evaluation graphs saved to:", viz_dir)
print("   - actual_vs_predicted.png")
print("   - residuals_plot.png") 
print("   - error_distribution.png")
print("   - feature_importance.png")
print("   - metrics_comparison.png")
print("   - price_distributions.png")

print("Price context for your model metrics:")
print(f"Range: ${y_test.min():.0f} - ${y_test.max():.0f}")  # Test data only!
print(f"Average: ${y_test.mean():.0f}")  # Test data average!
print(f"Your MAE (${mae:.2f}) is {mae/y.mean()*100:.1f}% of average price")
print(f"Your RMSE (${rmse:.2f}) is {rmse/y.mean()*100:.1f}% of average price")