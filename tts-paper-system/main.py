import sqlite3
import functools
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from datetime import datetime
import random
import hashlib

app = Flask(__name__)
app.secret_key = 'your_secret_key'

DATABASE = 'tss.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                email TEXT,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status INTEGER DEFAULT 1
            )
        ''')

        cursor.execute("SELECT COUNT(*) as count FROM users WHERE username = 'admin'")
        if cursor.fetchone()['count'] == 0:
            admin_password = hashlib.md5('admin123'.encode()).hexdigest()
            cursor.execute('''
                INSERT INTO users (username, password, email, role, status)
                VALUES (?, ?, ?, ?, ?)
            ''', ('admin', admin_password, 'admin@tss.com', 'admin', 1))

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS destinations (
                code TEXT PRIMARY KEY,
                name TEXT,
                price REAL,
                stock INTEGER
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                destination_code TEXT,
                ticket_type TEXT,
                seat_type TEXT,
                price REAL,
                purchase_time DATETIME,
                payment_method TEXT,
                status TEXT,
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')

        cursor.execute("SELECT COUNT(*) as count FROM destinations")
        if cursor.fetchone()['count'] == 0:
            cursor.execute('''
                INSERT INTO destinations (code, name, price, stock) VALUES
                ('2U0', '总站', 10.00, 50),
                ('3K1', '南站', 8.50, 30),
                ('4M2', '东站', 12.00, 20)
            ''')

        conn.commit()
        cursor.close()
        conn.close()
        print("数据库初始化完成")
    except Exception as e:
        print(f"数据库初始化失败: {e}")
        raise

def login_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('请先登录', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('请先登录', 'warning')
            return redirect(url_for('login'))
        if session.get('role') != 'admin':
            flash('无权限访问', 'danger')
            return redirect(url_for('dashboard'))
        return f(*args, **kwargs)
    return decorated_function

class TicketSellSys:
    def __init__(self):
        self.destinations = {}
        self.ticket_types = ['单程票', '多次往返票']
        self.seat_types = ['普通座', '舒适座']
        self.load_destinations()

    def load_destinations(self):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT code, name, price, stock FROM destinations")
            for row in cursor.fetchall():
                self.destinations[row['code']] = {
                    'name': row['name'],
                    'price': float(row['price']),
                    'stock': row['stock']
                }
            cursor.close()
            conn.close()
        except sqlite3.OperationalError:
            self.destinations = {}

    def calculate_price(self, dest_code, ticket_type, seat_type):
        base_price = self.destinations[dest_code]['price']
        return base_price * (1.5 if ticket_type == '多次往返票' else 1) * \
               (1.2 if seat_type == '舒适座' else 1)

    def save_ticket(self, dest_code, ticket_type, seat_type, price, payment_method, user_id=None):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO tickets (destination_code, ticket_type, seat_type, price, purchase_time, payment_method, status, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (dest_code, ticket_type, seat_type, price, datetime.now(), payment_method, '已支付', user_id))
            cursor.execute('UPDATE destinations SET stock = stock - 1 WHERE code = ?', (dest_code,))
            conn.commit()
            cursor.close()
            conn.close()
            self.load_destinations()
        except Exception as e:
            print(f"保存票务失败: {e}")
            conn.rollback()
            raise

tss = TicketSellSys()

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        password_md5 = hashlib.md5(password.encode()).hexdigest()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE username = ? AND password = ? AND status = 1', (username, password_md5))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']
            flash('登录成功', 'success')
            return redirect(url_for('dashboard'))
        flash('用户名或密码错误', 'danger')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        email = request.form.get('email', '')
        if password != confirm_password:
            flash('两次输入密码不一致', 'danger')
            return render_template('register.html')
        password_md5 = hashlib.md5(password.encode()).hexdigest()
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
                          (username, password_md5, email, 'user'))
            conn.commit()
            cursor.close()
            conn.close()
            flash('注册成功，请登录', 'success')
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            flash('用户名已存在', 'danger')
            return render_template('register.html')
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('已退出登录', 'success')
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM users')
    user_count = cursor.fetchone()['count']
    cursor.execute('SELECT COUNT(*) as count FROM destinations')
    dest_count = cursor.fetchone()['count']
    cursor.execute('SELECT COUNT(*) as count FROM tickets')
    ticket_count = cursor.fetchone()['count']
    cursor.execute('SELECT COALESCE(SUM(price), 0) as total FROM tickets')
    total_revenue = cursor.fetchone()['total'] or 0
    cursor.execute('''
        SELECT t.*, d.name as dest_name FROM tickets t
        LEFT JOIN destinations d ON t.destination_code = d.code
        ORDER BY t.purchase_time DESC LIMIT 5
    ''')
    recent_tickets = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template('dashboard.html',
                           user_count=user_count,
                           dest_count=dest_count,
                           ticket_count=ticket_count,
                           total_revenue=total_revenue,
                           recent_tickets=recent_tickets,
                           current_time=datetime.now())

@app.route('/users')
@admin_required
def users():
    conn = get_db_connection()
    cursor = conn.cursor()
    page = request.args.get('page', 1, type=int)
    per_page = 10
    offset = (page - 1) * per_page
    cursor.execute('SELECT COUNT(*) as count FROM users')
    total = cursor.fetchone()['count']
    cursor.execute('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?', (per_page, offset))
    users_list = cursor.fetchall()
    cursor.close()
    conn.close()
    total_pages = (total + per_page - 1) // per_page
    return render_template('users.html', users=users_list, page=page, total_pages=total_pages)

@app.route('/users/add', methods=['GET', 'POST'])
@admin_required
def add_user():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        email = request.form.get('email', '')
        role = request.form.get('role', 'user')
        password_md5 = hashlib.md5(password.encode()).hexdigest()
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
                          (username, password_md5, email, role))
            conn.commit()
            cursor.close()
            conn.close()
            flash('用户添加成功', 'success')
            return redirect(url_for('users'))
        except sqlite3.IntegrityError:
            flash('用户名已存在', 'danger')
    return render_template('user_form.html', user=None)

@app.route('/users/edit/<int:user_id>', methods=['GET', 'POST'])
@admin_required
def edit_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    user = cursor.fetchone()
    if request.method == 'POST':
        username = request.form['username']
        email = request.form.get('email', '')
        role = request.form.get('role', 'user')
        status = request.form.get('status', 0)
        password = request.form.get('password', '')
        update_data = {'username': username, 'email': email, 'role': role, 'status': int(status)}
        if password:
            update_data['password'] = hashlib.md5(password.encode()).hexdigest()
        set_clause = ', '.join([f'{k}=?' for k in update_data.keys()])
        values = list(update_data.values()) + [user_id]
        cursor.execute(f'UPDATE users SET {set_clause} WHERE id = ?', values)
        conn.commit()
        flash('用户更新成功', 'success')
        return redirect(url_for('users'))
    cursor.close()
    conn.close()
    return render_template('user_form.html', user=user)

@app.route('/users/delete/<int:user_id>')
@admin_required
def delete_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    cursor.close()
    conn.close()
    flash('用户删除成功', 'success')
    return redirect(url_for('users'))

@app.route('/destinations')
@admin_required
def destinations():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM destinations ORDER BY code')
    dest_list = cursor.fetchall()
    cursor.close()
    conn.close()
    return render_template('destinations.html', destinations=dest_list)

@app.route('/destinations/add', methods=['GET', 'POST'])
@admin_required
def add_destination():
    if request.method == 'POST':
        code = request.form['code'].upper()
        name = request.form['name']
        price = request.form['price']
        stock = request.form['stock']
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('INSERT INTO destinations (code, name, price, stock) VALUES (?, ?, ?, ?)',
                          (code, name, price, stock))
            conn.commit()
            cursor.close()
            conn.close()
            tss.load_destinations()
            flash('目的地添加成功', 'success')
            return redirect(url_for('destinations'))
        except sqlite3.IntegrityError:
            flash('目的地代码已存在', 'danger')
    return render_template('destination_form.html', destination=None)

@app.route('/destinations/edit/<string:code>', methods=['GET', 'POST'])
@admin_required
def edit_destination(code):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM destinations WHERE code = ?', (code,))
    destination = cursor.fetchone()
    if request.method == 'POST':
        name = request.form['name']
        price = request.form['price']
        stock = request.form['stock']
        cursor.execute('UPDATE destinations SET name=?, price=?, stock=? WHERE code=?',
                      (name, price, stock, code))
        conn.commit()
        tss.load_destinations()
        flash('目的地更新成功', 'success')
        return redirect(url_for('destinations'))
    cursor.close()
    conn.close()
    return render_template('destination_form.html', destination=destination)

@app.route('/destinations/delete/<string:code>')
@admin_required
def delete_destination(code):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM destinations WHERE code = ?', (code,))
    conn.commit()
    cursor.close()
    conn.close()
    tss.load_destinations()
    flash('目的地删除成功', 'success')
    return redirect(url_for('destinations'))

@app.route('/tickets')
@login_required
def tickets():
    conn = get_db_connection()
    cursor = conn.cursor()
    page = request.args.get('page', 1, type=int)
    per_page = 10
    offset = (page - 1) * per_page
    if session.get('role') == 'admin':
        cursor.execute('SELECT COUNT(*) as count FROM tickets')
    else:
        cursor.execute('SELECT COUNT(*) as count FROM tickets WHERE user_id = ?', (session['user_id'],))
    total = cursor.fetchone()['count']
    if session.get('role') == 'admin':
        cursor.execute('''
            SELECT t.*, d.name as dest_name FROM tickets t
            LEFT JOIN destinations d ON t.destination_code = d.code
            ORDER BY t.purchase_time DESC LIMIT ? OFFSET ?
        ''', (per_page, offset))
    else:
        cursor.execute('''
            SELECT t.*, d.name as dest_name FROM tickets t
            LEFT JOIN destinations d ON t.destination_code = d.code
            WHERE t.user_id = ?
            ORDER BY t.purchase_time DESC LIMIT ? OFFSET ?
        ''', (session['user_id'], per_page, offset))
    tickets_list = cursor.fetchall()
    cursor.close()
    conn.close()
    total_pages = (total + per_page - 1) // per_page
    return render_template('tickets.html', tickets=tickets_list, page=page, total_pages=total_pages)

@app.route('/tickets/delete/<int:ticket_id>')
@admin_required
def delete_ticket(ticket_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT destination_code FROM tickets WHERE id = ?', (ticket_id,))
    result = cursor.fetchone()
    if result:
        cursor.execute('UPDATE destinations SET stock = stock + 1 WHERE code = ?', (result['destination_code'],))
        cursor.execute('DELETE FROM tickets WHERE id = ?', (ticket_id,))
        conn.commit()
        tss.load_destinations()
    cursor.close()
    conn.close()
    flash('订单删除成功', 'success')
    return redirect(url_for('tickets'))

@app.route('/', methods=['GET', 'POST'])
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'start':
            session.pop('dest_code', None)
            session.pop('ticket_type', None)
            session.pop('seat_type', None)
            session.pop('price', None)
            return redirect(url_for('select_destination'))
        elif action == 'reset':
            flash('系统已重置', 'success')
            session.clear()
            return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/select_destination', methods=['GET', 'POST'])
@login_required
def select_destination():
    tss.load_destinations()
    if request.method == 'POST':
        dest_code = request.form['destination'].upper()
        if dest_code in tss.destinations and tss.destinations[dest_code]['stock'] > 0:
            session['dest_code'] = dest_code
            return redirect(url_for('select_options'))
        flash('无效的目的地代码或库存不足', 'danger')
    return render_template('select_destination.html', destinations=tss.destinations)

@app.route('/select_options', methods=['GET', 'POST'])
@login_required
def select_options():
    if 'dest_code' not in session:
        flash('请先选择目的地', 'warning')
        return redirect(url_for('select_destination'))
    if request.method == 'POST':
        ticket_type = request.form['ticket_type']
        seat_type = request.form['seat_type']
        price = tss.calculate_price(session['dest_code'], ticket_type, seat_type)
        session['ticket_type'] = ticket_type
        session['seat_type'] = seat_type
        session['price'] = price
        return redirect(url_for('payment'))
    return render_template('select_options.html', ticket_types=tss.ticket_types,
                         seat_types=tss.seat_types, dest_name=tss.destinations[session['dest_code']]['name'])

@app.route('/payment', methods=['GET', 'POST'])
@login_required
def payment():
    required_keys = ['dest_code', 'ticket_type', 'seat_type', 'price']
    if not all(k in session for k in required_keys):
        flash('购票流程出错，请重新开始', 'danger')
        return redirect(url_for('index'))
    if request.method == 'POST':
        payment_method = request.form['payment_method']
        try:
            tss.save_ticket(session['dest_code'], session['ticket_type'],
                           session['seat_type'], session['price'], payment_method, session['user_id'])
            return redirect(url_for('print_ticket'))
        except Exception as e:
            flash('购票失败，请重试', 'danger')
            return redirect(url_for('payment'))
    return render_template('payment.html', price=session['price'],
                         dest_name=tss.destinations[session['dest_code']]['name'],
                         ticket_type=session['ticket_type'], seat_type=session['seat_type'])

@app.route('/print_ticket')
@login_required
def print_ticket():
    required_keys = ['dest_code', 'ticket_type', 'seat_type', 'price']
    if not all(k in session for k in required_keys):
        flash('购票流程出错，请重新开始', 'danger')
        return redirect(url_for('index'))
    ticket_info = {
        'destination': tss.destinations[session['dest_code']]['name'],
        'ticket_type': session['ticket_type'],
        'seat_type': session['seat_type'],
        'price': session['price'],
        'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'ticket_id': random.randint(100000, 999999)
    }
    session.pop('dest_code', None)
    session.pop('ticket_type', None)
    session.pop('seat_type', None)
    session.pop('price', None)
    return render_template('print_ticket.html', ticket=ticket_info)

@app.route('/set_language/<lang>')
def set_language(lang):
    session['language'] = lang
    flash(f'语言已切换为{"中文" if lang == "zh" else "English"}', 'success')
    return redirect(request.referrer or url_for('dashboard'))

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    if not data:
        return jsonify({'success': False, 'message': '请求体不能为空'}), 400
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'success': False, 'message': '用户名和密码不能为空'}), 400
    password_md5 = hashlib.md5(password.encode()).hexdigest()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE username = ? AND password = ? AND status = 1', (username, password_md5))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    if user:
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        return jsonify({'success': True, 'message': '登录成功', 'user': {'id': user['id'], 'username': user['username'], 'role': user['role']}})
    return jsonify({'success': False, 'message': '用户名或密码错误'}), 401

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json
    if not data:
        return jsonify({'success': False, 'message': '请求体不能为空'}), 400
    username = data.get('username')
    password = data.get('password')
    confirm_password = data.get('confirm_password')
    email = data.get('email', '')
    if not username or not password or not confirm_password:
        return jsonify({'success': False, 'message': '用户名、密码和确认密码不能为空'}), 400
    if password != confirm_password:
        return jsonify({'success': False, 'message': '两次输入密码不一致'}), 400
    password_md5 = hashlib.md5(password.encode()).hexdigest()
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
                      (username, password_md5, email, 'user'))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'message': '注册成功'})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': '用户名已存在'}), 400

@app.route('/api/users', methods=['GET'])
def api_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    page = request.args.get('page', 1, type=int)
    per_page = 10
    offset = (page - 1) * per_page
    cursor.execute('SELECT COUNT(*) as count FROM users')
    total = cursor.fetchone()['count']
    cursor.execute('SELECT id, username, email, role, status, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?', (per_page, offset))
    users_list = [dict(row) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return jsonify({'success': True, 'data': users_list, 'total': total})

@app.route('/api/destinations', methods=['GET', 'POST'])
def api_destinations():
    conn = get_db_connection()
    cursor = conn.cursor()
    if request.method == 'GET':
        cursor.execute('SELECT * FROM destinations ORDER BY code')
        dest_list = [dict(row) for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'data': dest_list})
    else:
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': '请求体不能为空'}), 400
        code = data.get('code')
        name = data.get('name')
        price = data.get('price')
        stock = data.get('stock')
        if not code or not name or price is None or stock is None:
            return jsonify({'success': False, 'message': 'code、name、price、stock 不能为空'}), 400
        code = code.upper()
        try:
            cursor.execute('INSERT INTO destinations (code, name, price, stock) VALUES (?, ?, ?, ?)',
                          (code, name, price, stock))
            conn.commit()
            tss.load_destinations()
            cursor.close()
            conn.close()
            return jsonify({'success': True, 'message': '添加成功'})
        except sqlite3.IntegrityError:
            return jsonify({'success': False, 'message': '代码已存在'}), 400

@app.route('/api/destinations/<string:code>', methods=['GET', 'PUT', 'DELETE'])
def api_destination_detail(code):
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'GET':
        cursor.execute('SELECT * FROM destinations WHERE code = ?', (code,))
        destination = cursor.fetchone()
        cursor.close()
        conn.close()
        if destination:
            return jsonify({'success': True, 'data': dict(destination)})
        return jsonify({'success': False, 'message': '目的地不存在'}), 404

    elif request.method == 'PUT':
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': '请求体不能为空'}), 400
        name = data.get('name')
        price = data.get('price')
        stock = data.get('stock')
        if not name or price is None or stock is None:
            return jsonify({'success': False, 'message': 'name、price、stock 不能为空'}), 400
        cursor.execute('SELECT * FROM destinations WHERE code = ?', (code,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'message': '目的地不存在'}), 404
        cursor.execute('UPDATE destinations SET name=?, price=?, stock=? WHERE code=?',
                      (name, price, stock, code))
        conn.commit()
        tss.load_destinations()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'message': '更新成功'})

    elif request.method == 'DELETE':
        cursor.execute('SELECT * FROM destinations WHERE code = ?', (code,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'message': '目的地不存在'}), 404
        cursor.execute('DELETE FROM destinations WHERE code = ?', (code,))
        conn.commit()
        tss.load_destinations()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'message': '删除成功'})

@app.route('/api/purchase/price', methods=['POST'])
def api_calculate_price():
    data = request.json
    if not data:
        return jsonify({'success': False, 'message': '请求体不能为空'}), 400
    dest_code = data.get('dest_code')
    ticket_type = data.get('ticket_type')
    seat_type = data.get('seat_type')
    if not dest_code or not ticket_type or not seat_type:
        return jsonify({'success': False, 'message': 'dest_code、ticket_type、seat_type 不能为空'}), 400
    tss.load_destinations()
    if dest_code not in tss.destinations:
        return jsonify({'success': False, 'message': '目的地不存在'}), 404
    dest = tss.destinations[dest_code]
    if dest['stock'] <= 0:
        return jsonify({'success': False, 'message': '库存不足'}), 400
    if ticket_type not in tss.ticket_types:
        return jsonify({'success': False, 'message': '无效的票种类型'}), 400
    if seat_type not in tss.seat_types:
        return jsonify({'success': False, 'message': '无效的座位类型'}), 400
    price = tss.calculate_price(dest_code, ticket_type, seat_type)
    return jsonify({
        'success': True,
        'data': {
            'dest_code': dest_code,
            'dest_name': dest['name'],
            'ticket_type': ticket_type,
            'seat_type': seat_type,
            'base_price': dest['price'],
            'price': price,
            'stock': dest['stock']
        }
    })

@app.route('/api/purchase/buy', methods=['POST'])
def api_buy_ticket():
    data = request.json
    if not data:
        return jsonify({'success': False, 'message': '请求体不能为空'}), 400
    dest_code = data.get('dest_code')
    ticket_type = data.get('ticket_type')
    seat_type = data.get('seat_type')
    payment_method = data.get('payment_method')
    user_id = data.get('user_id')
    if not dest_code or not ticket_type or not seat_type or not payment_method:
        return jsonify({'success': False, 'message': 'dest_code、ticket_type、seat_type、payment_method 不能为空'}), 400
    if payment_method not in ['MCard', '现金']:
        return jsonify({'success': False, 'message': '支付方式无效，仅支持 MCard 或 现金'}), 400
    tss.load_destinations()
    if dest_code not in tss.destinations:
        return jsonify({'success': False, 'message': '目的地不存在'}), 404
    dest = tss.destinations[dest_code]
    if dest['stock'] <= 0:
        return jsonify({'success': False, 'message': '库存不足'}), 400
    price = tss.calculate_price(dest_code, ticket_type, seat_type)
    try:
        tss.save_ticket(dest_code, ticket_type, seat_type, price, payment_method, user_id)
        return jsonify({
            'success': True,
            'message': '购票成功',
            'data': {
                'destination': dest['name'],
                'ticket_type': ticket_type,
                'seat_type': seat_type,
                'price': price,
                'payment_method': payment_method,
                'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'ticket_id': random.randint(100000, 999999)
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': '购票失败，请重试'}), 500

@app.route('/api/tickets/<int:ticket_id>', methods=['GET', 'DELETE'])
def api_ticket_detail(ticket_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'GET':
        cursor.execute('''
            SELECT t.*, d.name as dest_name FROM tickets t
            LEFT JOIN destinations d ON t.destination_code = d.code
            WHERE t.id = ?
        ''', (ticket_id,))
        ticket = cursor.fetchone()
        cursor.close()
        conn.close()
        if ticket:
            return jsonify({'success': True, 'data': dict(ticket)})
        return jsonify({'success': False, 'message': '订单不存在'}), 404

    elif request.method == 'DELETE':
        cursor.execute('SELECT destination_code FROM tickets WHERE id = ?', (ticket_id,))
        result = cursor.fetchone()
        if not result:
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'message': '订单不存在'}), 404
        cursor.execute('UPDATE destinations SET stock = stock + 1 WHERE code = ?', (result['destination_code'],))
        cursor.execute('DELETE FROM tickets WHERE id = ?', (ticket_id,))
        conn.commit()
        tss.load_destinations()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'message': '删除成功'})

@app.route('/api/tickets', methods=['GET'])
def api_tickets():
    conn = get_db_connection()
    cursor = conn.cursor()
    page = request.args.get('page', 1, type=int)
    per_page = 10
    offset = (page - 1) * per_page
    cursor.execute('SELECT COUNT(*) as count FROM tickets')
    total = cursor.fetchone()['count']
    cursor.execute('''
        SELECT t.*, d.name as dest_name FROM tickets t
        LEFT JOIN destinations d ON t.destination_code = d.code
        ORDER BY t.purchase_time DESC LIMIT ? OFFSET ?
    ''', (per_page, offset))
    tickets_list = [dict(row) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return jsonify({'success': True, 'data': tickets_list, 'total': total})

@app.route('/api/users/<int:user_id>', methods=['GET', 'PUT', 'DELETE'])
def api_user_detail(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'GET':
        cursor.execute('SELECT id, username, email, role, status, created_at FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        if user:
            return jsonify({'success': True, 'data': dict(user)})
        return jsonify({'success': False, 'message': '用户不存在'}), 404

    elif request.method == 'PUT':
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': '请求体不能为空'}), 400
        username = data.get('username')
        email = data.get('email', '')
        role = data.get('role', 'user')
        status = data.get('status', 1)
        password = data.get('password', '')
        if not username:
            return jsonify({'success': False, 'message': '用户名不能为空'}), 400
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'message': '用户不存在'}), 404
        update_data = {'username': username, 'email': email, 'role': role, 'status': int(status)}
        if password:
            update_data['password'] = hashlib.md5(password.encode()).hexdigest()
        set_clause = ', '.join([f'{k}=?' for k in update_data.keys()])
        values = list(update_data.values()) + [user_id]
        cursor.execute(f'UPDATE users SET {set_clause} WHERE id = ?', values)
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'message': '更新成功'})

    elif request.method == 'DELETE':
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'message': '用户不存在'}), 404
        cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'message': '删除成功'})

@app.route('/api/dashboard', methods=['GET'])
def api_dashboard():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM users')
    user_count = cursor.fetchone()['count']
    cursor.execute('SELECT COUNT(*) as count FROM destinations')
    dest_count = cursor.fetchone()['count']
    cursor.execute('SELECT COUNT(*) as count FROM tickets')
    ticket_count = cursor.fetchone()['count']
    cursor.execute('SELECT COALESCE(SUM(price), 0) as total FROM tickets')
    total_revenue = cursor.fetchone()['total'] or 0
    cursor.execute('''
        SELECT t.*, d.name as dest_name FROM tickets t
        LEFT JOIN destinations d ON t.destination_code = d.code
        ORDER BY t.purchase_time DESC LIMIT 5
    ''')
    recent_tickets = [dict(row) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return jsonify({
        'success': True,
        'data': {
            'user_count': user_count,
            'destination_count': dest_count,
            'ticket_count': ticket_count,
            'total_revenue': total_revenue,
            'recent_tickets': recent_tickets
        }
    })

if __name__ == "__main__":
    init_database()
    tss = TicketSellSys()
    app.run(debug=True)
