from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
from flask_cors import CORS
import os, joblib, sqlite3, hashlib, pandas as pd, numpy as np

# --- Base directory (Prilythic root) ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=os.path.join(BASE_DIR, 'static')
)
CORS(app)

app.secret_key = 'prilythic_secret_2025'  # for session management

DB_PATH = os.path.join(BASE_DIR, 'userAcc.db')

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

init_db() 

# --- Model and Scaler Paths ---
model_path = os.path.join(BASE_DIR, 'PYTHON', 'orfm4.pkl')
scaler_path = os.path.join(BASE_DIR, 'PYTHON', 's4.pkl')
data_path = os.path.join(BASE_DIR, 'PYTHON', 'Data2.csv')

# --- Load model and scaler ---
model = joblib.load(model_path)
scaler = joblib.load(scaler_path)

UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
DATA_FOLDER = os.path.join(BASE_DIR, 'data')

# Create folders if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATA_FOLDER, exist_ok=True)


@app.route('/', methods=['GET', 'POST'])
def login_page():
    error = None

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        conn = get_db_connection()
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        conn.close()

        # Check if user exists and password matches
        if user and user['password'] == hash_password(password):
            session['username'] = username

            # Load saved products if any
            selected = user['selected_products'] or ""
            session['selected_products'] = selected.split(",") if selected else []

            # Redirect based on whether user has chosen products
            if session['selected_products']:
                return redirect(url_for('dashboard'))
            else:
                return redirect(url_for('product_select'))

        # Invalid credentials
        error = 'Invalid username or password'

    # Always render login page if GET or invalid login
    return render_template('LoginF.html', error=error)



# --- Registration Page ---
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')

        if not username or not password or not confirm_password:
            error = "All fields are required."
        elif password != confirm_password:
            error = "Passwords do not match."
        else:
            conn = get_db_connection()
            try:
                conn.execute(
                    "INSERT INTO users (username, password) VALUES (?, ?)",
                    (username, hash_password(password))
                )
                conn.commit()
                conn.close()
                return redirect(url_for('login_page'))
            except sqlite3.IntegrityError:
                error = "Username already exists."
    return render_template('Signin.html', error=error)



@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        return redirect(url_for('login_page'))

    if not session.get('selected_products'):
        return redirect(url_for('product_select'))

    username = session['username']
    selected_products = session.get('selected_products', [])

    products_info = []
    data_file = os.path.join(DATA_FOLDER, session['loaded_csv']) if session.get('loaded_csv') else data_path
    df = pd.read_csv(data_file)

    for product in selected_products:
        clean_product = product.replace("c_", "")
        if product not in df.columns or df[product].dropna().shape[0] < 1:
            continue

        data = df[['price_date', product]].dropna()
        data['price_date'] = pd.to_datetime(data['price_date'])
        data = data.sort_values('price_date')

        # Remove duplicate months, keep last
        data['year_month'] = data['price_date'].dt.to_period('M')
        data = data.drop_duplicates(subset='year_month', keep='last').drop(columns=['year_month'])

        last_prices = data[product].values
        last_date = data['price_date'].max()
        next_date = last_date + pd.DateOffset(months=1)

        # --- Lag features ---
        lags = 12
        lag_values = [last_prices[-i] if i <= len(last_prices) else 0 for i in range(1, lags + 1)]
        lag_dict = {f'price_lag{i+1}': [lag_values[i]] for i in range(lags)}

        # --- 6-month rolling mean ---
        price_roll6 = np.mean(last_prices[-6:]) if len(last_prices) >= 1 else 0

        input_data = {
            'year': [next_date.year],
            'month': [next_date.month],
            'dayofweek': [0],
            **lag_dict,
            'price_roll6': [price_roll6]
        }

        # --- One-hot encoding ---
        for col in scaler.feature_names_in_:
            if col.startswith('product_'):
                input_data[col] = [1 if col == f'product_{clean_product}' else 0]

        df_input = pd.DataFrame(input_data)
        df_input = df_input.reindex(columns=scaler.feature_names_in_, fill_value=0)
        df_scaled = scaler.transform(df_input)
        predicted_price = model.predict(df_scaled)[0]

        hist_data = data.tail(12).copy()
        hist_data['price_date'] = hist_data['price_date'].dt.strftime('%Y-%m-%d')

        products_info.append({
            "name": clean_product.replace("_", " ").title(),
            "historical": hist_data.to_dict(orient='records'),
            "predicted_price": float(predicted_price),
            "next_month": f"{next_date.year}-{next_date.month:02d}-01",
        })

    return render_template(
        'Dashboard.html',
        products_info=products_info,
        selected_products=[p.replace("c_", "").replace("_", " ").title() for p in selected_products], 
        username=username
    )

# --- Product Selection Page ---
@app.route("/productSelect", methods=["GET", "POST"])
def product_select():
    if 'username' not in session:
        return redirect(url_for('login_page'))

    df = pd.read_csv(data_path)
    product_columns = [col for col in df.columns if col.startswith("c_")]
    products_map = {col.replace("c_", "").replace("_", " ").title(): col for col in product_columns}

    error = None

    if request.method == 'POST':
        selected_display = request.form.getlist('products')
        if len(selected_display) != 3:
            error = "Please select exactly 3 products."
            return render_template(
                "ProductSelect.html", 
                products_info=list(products_map.keys()), 
                error=error
            )

        selected_columns = [products_map[name] for name in selected_display]

        # --- Save to session ---
        session['selected_products'] = selected_columns
        print(f"[DEBUG] Selected columns: {selected_columns}")

        # --- Save to database ---
        conn = get_db_connection()
        print(f"[DEBUG] Saving products for username: {session['username']}")
        conn.execute(
            "UPDATE users SET selected_products = ? WHERE username = ?",
            (",".join(selected_columns), session['username'])
        )
        conn.commit()
        conn.close()
        print("[DEBUG] Update committed to database.")

        # --- Verify immediately ---
        verify_conn = get_db_connection()
        res = verify_conn.execute("SELECT username, selected_products FROM users").fetchall()
        verify_conn.close()
        print("[DEBUG] Current DB content:", res)

        return redirect(url_for('dashboard'))

    return render_template(
        "ProductSelect.html",
        products_info=list(products_map.keys()),
        error=error
    )
# --- Categories Route ---
@app.route('/categories')
def categories():
    username = session['username']
    return render_template('Categories.html', username=username)


# --- Settings Route ---
@app.route('/settings')
def settings():
    username = session['username']
    csv_files = [f for f in os.listdir(DATA_FOLDER) if f.endswith('.csv')]
    return render_template('Settings.html', csv_files=csv_files, username=username)


# --- Preferences Route ---
@app.route('/preferences')
def preferences():
    return render_template('preferences.html')  

# --- Helper function for product pages ---
def render_product_page(product, template_name):
    if 'username' not in session:
        return redirect(url_for('login_page'))

    # Use uploaded CSV if available, else default
    data_file = os.path.join(DATA_FOLDER, session['loaded_csv']) if session.get('loaded_csv') else data_path
    df = pd.read_csv(data_file)

    clean_product = product.replace("c_", "")

    if product not in df.columns or df[product].dropna().shape[0] < 1:
        return render_template(f'{template_name}.html', info=None)

    data = df[['price_date', product]].dropna()
    data['price_date'] = pd.to_datetime(data['price_date'])
    data = data.sort_values('price_date')

    last_prices = data[product].values
    last_date = data['price_date'].max()
    next_date = last_date + pd.DateOffset(months=1)

    # --- Lag features ---
    lags = 12
    lag_values = [last_prices[-i] if i <= len(last_prices) else 0 for i in range(1, lags + 1)]
    lag_dict = {f'price_lag{i+1}': [lag_values[i]] for i in range(lags)}

    # --- 6-month rolling mean ---
    price_roll6 = np.mean(last_prices[-6:]) if len(last_prices) >= 1 else 0

    input_data = {
        'year': [next_date.year],
        'month': [next_date.month],
        'dayofweek': [0],
        **lag_dict,
        'price_roll6': [price_roll6]
    }

    # --- One-hot encoding ---
    for col in scaler.feature_names_in_:
        if col.startswith('product_'):
            input_data[col] = [1 if col == f'product_{clean_product}' else 0]

    df_input = pd.DataFrame(input_data)
    df_input = df_input.reindex(columns=scaler.feature_names_in_, fill_value=0)
    df_scaled = scaler.transform(df_input)
    predicted_price = model.predict(df_scaled)[0]

    hist_data = data.tail(12).copy()
    hist_data['price_date'] = hist_data['price_date'].dt.strftime('%Y-%m-%d')

    info = {
        "name": clean_product.replace("_", " ").title(),
        "historical": hist_data.to_dict(orient='records'),
        "predicted_price": float(predicted_price),
        "next_month": f"{next_date.year}-{next_date.month:02d}-01"
    }

    return render_template(f'{template_name}.html', info=info)

# --- Meat Category Page ---
@app.route('/meat')
def meat():
    return render_template('meat.html')


# --- Meat Product Pages ---
@app.route('/chicken')
def chicken():
    return render_product_page('c_meat_chicken_whole', 'chicken')

@app.route('/beef')
def beef():
    return render_product_page('c_meat_beef_chops', 'beef')

@app.route('/pork')
def pork():
    return render_product_page('c_meat_pork', 'pork')


# --- Vegetable Category Page ---
@app.route('/vegetable')
def vegetable():
    return render_template('vegetable.html')


# --- Individual Vegetable Product Pages ---
@app.route('/beans')
def beans():
    return render_product_page('c_beans', 'beans')

@app.route('/carrots')
def carrots():
    return render_product_page('c_carrots', 'carrot')

@app.route('/cabbage')
def cabbage():
    return render_product_page('c_cabbage', 'cabbage')

@app.route('/tomatoes')
def tomatoes():
    return render_product_page('c_tomatoes', 'tomatoes')

@app.route('/potatoes')
def potatoes():
    return render_product_page('c_potatoes', 'potato')


# --- Cooking Essentials Category Page ---
@app.route('/cook')
def cook():
    return render_template('cook.html')


# --- Individual Cooking Essentials Pages ---
@app.route('/onions')
def onions():
    return render_product_page('c_onions', 'onions')

@app.route('/rice')
def rice():
    return render_product_page('c_rice', 'rice')

@app.route('/eggs')
def eggs():
    return render_product_page('c_eggs', 'eggs')


# --- Logout Route ---
@app.route('/logout')
def logout():
    session.clear()  # removes all stored session data
    return redirect(url_for('login_page'))

# --- Prediction API Route ---
@app.route('/predict/<product>', methods=['GET'])
def predict(product):
    
    data_file = os.path.join(DATA_FOLDER, session['loaded_csv']) if session.get('loaded_csv') else data_path
    df = pd.read_csv(data_file)

    if product not in df.columns:
        return jsonify({'error': f'Product "{product}" not found in dataset.'}), 400

    data = df[['price_date', product]].dropna()
    data['price_date'] = pd.to_datetime(data['price_date'])
    data = data.sort_values('price_date')

    if data.shape[0] < 1:
        return jsonify({'error': f'Not enough data for "{product}"'}), 400

    last_prices = data[product].values
    last_date = data['price_date'].max()
    next_date = last_date + pd.DateOffset(months=1)

    # --- Lag features ---
    lags = 12
    lag_values = [last_prices[-i] if i <= len(last_prices) else 0 for i in range(1, lags + 1)]
    lag_dict = {f'price_lag{i+1}': [lag_values[i]] for i in range(lags)}

    # --- 6-month rolling mean ---
    price_roll6 = np.mean(last_prices[-6:]) if len(last_prices) >= 1 else 0

    input_data = {
        'year': [next_date.year],
        'month': [next_date.month],
        'dayofweek': [0],
        **lag_dict,
        'price_roll6': [price_roll6]
    }

    clean_product = product.replace("c_", "")
    for col in scaler.feature_names_in_:
        if col.startswith('product_'):
            input_data[col] = [1 if col == f'product_{clean_product}' else 0]

    df_input = pd.DataFrame(input_data)
    df_input = df_input.reindex(columns=scaler.feature_names_in_, fill_value=0)
    df_scaled = scaler.transform(df_input)
    predicted_price = model.predict(df_scaled)[0]

    hist_data = data.tail(12).copy()
    hist_data['price_date'] = hist_data['price_date'].dt.strftime('%Y-%m-%d')

    return jsonify({
        'product': product,
        'historical': hist_data.to_dict(orient='records'),
        'predicted_next_month': round(float(predicted_price), 2),
        'next_month': f"{next_date.year}-{next_date.month:02d}-01"
    })

@app.route('/import_csv', methods=['POST'])
def import_csv():
    if 'csv_file' not in request.files:
        flash("No file part", "danger")
        return redirect(url_for('settings'))
    
    file = request.files['csv_file']
    
    if file.filename == '':
        flash("No selected file", "danger")
        return redirect(url_for('settings'))
    
    if file and file.filename.endswith('.csv'):
        # Save to uploads folder first
        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filepath)

        try:
            # Read new CSV
            new_data = pd.read_csv(filepath)

            # Determine target CSV in DATA_FOLDER
            # We'll use the filename itself as the product CSV name
            target_csv = os.path.join(DATA_FOLDER, file.filename)

            if os.path.exists(target_csv):
                # Merge with existing data (drop duplicates by 'price_date')
                existing_data = pd.read_csv(target_csv)
                combined = pd.concat([existing_data, new_data]).drop_duplicates(subset='price_date', keep='last')
                combined.to_csv(target_csv, index=False)
            else:
                # Save as new CSV
                new_data.to_csv(target_csv, index=False)

            flash(f"CSV '{file.filename}' uploaded and database updated!", "success")
        except Exception as e:
            flash(f"Error processing CSV: {e}", "danger")
        
        return redirect(url_for('settings'))
    
    flash("Invalid file type. Please upload a CSV.", "danger")
    return redirect(url_for('settings'))

@app.route('/load_csv/<filename>')
def load_csv(filename):
    file_path = os.path.join(DATA_FOLDER, filename)

    if not os.path.exists(file_path):
        flash(f"File '{filename}' not found.", "danger")
        return redirect(url_for('settings'))

    try:
        df = pd.read_csv(file_path)
        if df.empty:
            flash(f"The file '{filename}' is empty.", "warning")
            return redirect(url_for('settings'))

        # Save the filename in session so dashboard knows to use it
        session['loaded_csv'] = filename
        flash(f"CSV '{filename}' loaded successfully! Dashboard will use this data.", "success")
        return redirect(url_for('dashboard'))

    except Exception as e:
        flash(f"Error loading file: {str(e)}", "danger")
        return redirect(url_for('settings'))

@app.route('/delete_account', methods=['POST'])
def delete_account():
    if 'username' not in session:
        return redirect(url_for('login'))

    username = session['username']

    try:
        conn = sqlite3.connect('userAcc.db')
        c = conn.cursor()
        c.execute("DELETE FROM users WHERE username = ?", (username,))
        conn.commit()
        conn.close()

        # Clear session after deleting
        session.clear()
        flash("Your account has been deleted successfully.", "info")
        return redirect(url_for('login_page'))

    except Exception as e:
        flash("An error occurred while deleting your account.", "error")
        print("Error deleting account:", e)
        return redirect(url_for('settings'))
    
# --- Run the app ---
if __name__ == '__main__':
    app.run(debug=True)
