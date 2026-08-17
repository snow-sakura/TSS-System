"""本地启动脚本 - 用于验证修复后的 TSS 服务（端口 5002）"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 使用可写目录存放数据库
import tempfile
DB_DIR = '/Users/snow-sakura/Documents/aprillove/ai-testplate/test_data'
os.makedirs(DB_DIR, exist_ok=True)

from main import app, init_database, TicketSellSys
import main

# 修改数据库路径到可写目录
main.DATABASE = os.path.join(DB_DIR, 'tss.db')

# 初始化数据库
init_database()

# 创建全局 tss 实例
main.tss = TicketSellSys()

if __name__ == '__main__':
    print(f"🚀 TSS 服务启动中 (端口 5002, DB: {main.DATABASE})...")
    # threaded=False 避免 SQLite 并发锁定问题
    app.run(debug=False, host='0.0.0.0', port=5002, threaded=False)
