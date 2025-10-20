import os, joblib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Paths
MODEL_DIR = os.path.join(BASE_DIR, 'models')
SCALER_PATH = os.path.join(BASE_DIR, 'scalers', 'scaler.pkl')

# Load shared scaler (if using one for all products)
scaler = joblib.load(SCALER_PATH)

# Cache for loaded models
product_models = {}

def load_product_model(product_code):
    """
    Load a product-specific model from disk and cache it.
    product_code: e.g., 'c_beans', 'c_meat_chicken_whole'
    """
    if product_code in product_models:
        return product_models[product_code]

    model_file = os.path.join(MODEL_DIR, f"{product_code}.pkl")
    if not os.path.exists(model_file):
        raise FileNotFoundError(f"Model for {product_code} not found at {model_file}")

    model = joblib.load(model_file)
    product_models[product_code] = model
    return model
