"""验证码模块 - 数学算式验证码"""

import random
import io
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

# 字体路径（使用系统字体）
FONT_DIR = Path(__file__).parent / "static" / "fonts"
FONT_PATH = None

# 尝试查找中文字体
_candidates = [
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
]
for p in _candidates:
    if Path(p).exists():
        FONT_PATH = p
        break


def generate_captcha():
    """生成数学算式验证码
    
    Returns:
        (image_bytes, answer): 验证码图片字节和正确结果
    """
    # 生成算式
    operators = ['+', '-']
    a = random.randint(10, 99)
    b = random.randint(1, 99)
    op = random.choice(operators)
    
    if op == '+':
        answer = a + b
    else:
        # 确保结果为正数
        if a < b:
            a, b = b, a
        answer = a - b
    
    text = f"{a} {op} {b} = ?"
    
    # 生成图片
    width, height = 200, 70
    img = Image.new('RGB', (width, height), color=(255, 248, 240))
    draw = ImageDraw.Draw(img)
    
    # 绘制干扰线
    for _ in range(5):
        x1 = random.randint(0, width)
        y1 = random.randint(0, height)
        x2 = random.randint(0, width)
        y2 = random.randint(0, height)
        draw.line([(x1, y1), (x2, y2)], fill=(237, 224, 212), width=2)
    
    # 绘制干扰点
    for _ in range(50):
        x = random.randint(0, width)
        y = random.randint(0, height)
        draw.point((x, y), fill=(237, 224, 212))
    
    # 绘制文字
    font_size = 28
    try:
        if FONT_PATH:
            font = ImageFont.truetype(FONT_PATH, font_size)
        else:
            font = ImageFont.load_default()
    except Exception:
        font = ImageFont.load_default()
    
    # 计算文字位置（居中）
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) // 2
    y = (height - text_height) // 2 - 5
    
    # 逐个字符绘制，颜色轻微变化
    colors = [
        (212, 165, 116),  # 暖杏色
        (192, 141, 94),   # 深杏色
        (160, 118, 74),   # 棕杏色
        (141, 110, 99),   # 暖棕色
        (93, 64, 55),     # 深棕色
    ]
    
    char_x = x
    for char in text:
        c = random.choice(colors)
        offset_y = random.randint(-3, 3)
        draw.text((char_x, y + offset_y), char, fill=c, font=font)
        char_bbox = draw.textbbox((0, 0), char, font=font)
        char_x += char_bbox[2] - char_bbox[0] + 2
    
    # 保存到字节流
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    
    return buf.getvalue(), answer


def verify_captcha(user_input, expected):
    """验证用户输入的验证码答案"""
    try:
        return int(user_input) == expected
    except (ValueError, TypeError):
        return False
