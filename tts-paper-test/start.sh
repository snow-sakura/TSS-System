#!/bin/bash

# TSS AI测试平台启动脚本

echo "==================================="
echo "  TSS AI测试平台"
echo "==================================="
echo ""

# 检查虚拟环境
if [ ! -d ".venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv .venv
fi

# 激活虚拟环境
echo "激活虚拟环境..."
source .venv/bin/activate

# 安装依赖
echo "检查依赖..."
pip install -r requirements.txt -q

# 检查环境变量
if [ ! -f ".env" ]; then
    echo "创建环境变量配置..."
    cp .env.example .env
fi

echo ""
echo "启动Web服务..."
echo "访问地址: http://localhost:5001"
echo "默认账户: admin / admin123"
echo ""
echo "按 Ctrl+C 停止服务"
echo "==================================="
echo ""

# 启动服务
python main.py web
