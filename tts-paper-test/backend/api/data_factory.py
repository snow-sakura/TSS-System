"""数据工厂路由

对标业界常用测试数据生成能力，提供 11 种真实格式的中文数据生成器：
姓名 / 手机号 / 邮箱 / 地址 / 身份证号 / 公司名 / 银行卡号 / 香港身份证 /
营业执照 / 经纬度 / 用户名。生成记录写入 data_factory_logs 供历史追溯。
"""

import random
import string
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from models.data_factory import DataFactoryLog
from schemas.common import ResponseModel
from api.deps import get_current_user_dep

router = APIRouter(prefix="/data-factory", tags=["数据工厂"])

# ════════════ 数据池 ════════════

_SURNAMES = list(
    "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜"
    "戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐"
    "费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹"
)
_GIVEN = list(
    "伟芳娜秀英敏静丽强磊军洋勇艳杰娟涛明超秀兰霞平刚桂英建华文辉国力"
    "雪松思远嘉懿浩然欣怡子涵雨桐俊杰诗涵梓萱宇轩若曦天佑思彤梓涵梦琪"
)
_PHONE_PREFIX = [
    "130",
    "131",
    "132",
    "133",
    "135",
    "136",
    "137",
    "138",
    "139",
    "150",
    "151",
    "152",
    "153",
    "155",
    "156",
    "157",
    "158",
    "159",
    "170",
    "171",
    "176",
    "177",
    "178",
    "180",
    "181",
    "182",
    "183",
    "185",
    "186",
    "187",
    "188",
    "189",
    "190",
    "191",
    "195",
    "196",
    "199",
]
_EMAIL_DOMAINS = [
    "qq.com",
    "163.com",
    "126.com",
    "gmail.com",
    "outlook.com",
    "sina.com",
    "foxmail.com",
    "hotmail.com",
    "aliyun.com",
]
_PROVINCES = [
    "北京市",
    "上海市",
    "广东省",
    "江苏省",
    "浙江省",
    "四川省",
    "湖北省",
    "湖南省",
    "福建省",
    "山东省",
    "河南省",
    "河北省",
    "陕西省",
    "重庆市",
    "辽宁省",
    "安徽省",
    "云南省",
    "江西省",
    "广西壮族自治区",
    "贵州省",
]
_CITIES = [
    "杭州市",
    "南京市",
    "成都市",
    "武汉市",
    "西安市",
    "苏州市",
    "郑州市",
    "青岛市",
    "长沙市",
    "福州市",
    "济南市",
    "合肥市",
    "昆明市",
    "南昌市",
    "贵阳市",
    "沈阳市",
]
_DISTRICTS = [
    "朝阳区",
    "浦东新区",
    "天河区",
    "西湖区",
    "鼓楼区",
    "武侯区",
    "南山区",
    "岳麓区",
    "高新区",
    "科技园区",
    "中心城区",
    "开发区",
]
_STREETS = [
    "中山路",
    "人民大道",
    "科技路",
    "建设街",
    "文化巷",
    "创业路",
    "滨江大道",
    "创新大道",
    "金融街",
    "软件园路",
]
_COMPANY_PREFIX = [
    "中科",
    "华信",
    "恒远",
    "蓝天",
    "凌云",
    "泰和",
    "博远",
    "卓越",
    "盛达",
    "国信",
    "万达",
    "天成",
    "易联",
    "创新",
    "联合",
    "智汇",
]
_COMPANY_INDUSTRY = [
    "科技",
    "信息技术",
    "网络",
    "软件",
    "数据",
    "智能",
    "云计算",
    "电子商务",
    "金融",
    "物流",
    "生物医药",
    "新能源",
    "文化传媒",
    "人工智能",
    "互联网",
    "数字",
]
_COMPANY_SUFFIX = [
    "有限公司",
    "科技有限公司",
    "信息技术有限公司",
    "网络科技有限公司",
    "数据服务有限公司",
    "智能科技有限公司",
]
_CARD_BINS = [
    "622202",
    "622848",
    "622588",
    "621700",
    "621661",
    "622262",
    "436742",
    "622575",
    "621558",
    "622280",
]
_REGION_CODES = [
    "110101",
    "110105",
    "310104",
    "440106",
    "440305",
    "330106",
    "320102",
    "510107",
    "420111",
    "430104",
    "350102",
    "370102",
    "410102",
    "130102",
    "610102",
    "500106",
]
_ORG_TYPES = ["9", "2", "1", "3", "4", "5", "6", "7", "8"]
_INSURANCE_CODE = "123456789"
_LLM_PREFIX = [
    "admin",
    "user",
    "test",
    "demo",
    "qa",
    "dev",
    "ops",
    "guest",
    "tester",
    "playwright",
    "selenium",
    "xiaoming",
    "xiaohong",
    "wangwu",
]
_LLM_SUFFIX = ["2024", "2025", "01", "02", "03", "007", "008", "168", "520", "888"]

# ════════════ 生成器实现 ════════════


def gen_cn_name(_p: dict) -> str:
    """中文姓名：姓 + 1~2 个常用字"""
    return random.choice(_SURNAMES) + "".join(
        random.choice(_GIVEN) for _ in range(random.randint(1, 2))
    )


def gen_phone(_p: dict) -> str:
    """大陆手机号：11 位，真实号段"""
    return random.choice(_PHONE_PREFIX) + "".join(
        random.choice(string.digits) for _ in range(8)
    )


def gen_email(_p: dict) -> str:
    """邮箱：随机前缀 + 常见域名"""
    prefix = "".join(
        random.choice(string.ascii_lowercase + string.digits)
        for _ in range(random.randint(6, 12))
    )
    return f"{prefix}@{random.choice(_EMAIL_DOMAINS)}"


def gen_address(_p: dict) -> str:
    """中文地址：省 + 市 + 区 + 街道 + 门牌号"""
    street = random.choice(_STREETS)
    num = random.randint(1, 999)
    unit = random.choice(["号", "号院", "幢", "栋"])
    return f"{random.choice(_PROVINCES)}{random.choice(_CITIES)}{random.choice(_DISTRICTS)}{street}{num}{unit}"


def gen_id_card(_p: dict) -> str:
    """身份证号：18 位，含合法校验位（GB 11643-1999）"""
    region = random.choice(_REGION_CODES)
    year = random.randint(1960, 2005)
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    order = f"{random.randint(0, 999):03d}"
    body = f"{region}{year:04d}{month:02d}{day:02d}{order}"
    weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
    checks = "10X98765432"
    total = sum(int(body[i]) * weights[i] for i in range(17))
    return body + checks[total % 11]


def gen_company(_p: dict) -> str:
    """公司名：字号 + 行业 + 组织形式"""
    return (
        random.choice(_COMPANY_PREFIX)
        + random.choice(_COMPANY_INDUSTRY)
        + random.choice(_COMPANY_SUFFIX)
    )


def gen_bank_card(_p: dict) -> str:
    """银行卡号：BIN + Luhn 校验位（16~19 位）"""
    bin_code = random.choice(_CARD_BINS)
    length = random.choice([16, 17, 18, 19])
    body = bin_code + "".join(
        random.choice(string.digits) for _ in range(length - len(bin_code) - 1)
    )

    def luhn_digit(prefix: str) -> str:
        digits = [int(c) for c in prefix]
        total = 0
        for i, d in enumerate(reversed(digits)):
            if i % 2 == 0:
                d *= 2
                if d > 9:
                    d -= 9
            total += d
        return str((10 - total % 10) % 10)

    return body + luhn_digit(body)


def gen_hk_id(_p: dict) -> str:
    """香港身份证：字母 + 6 位数字 + 括号校验字母/数字"""
    first = random.choice(string.ascii_uppercase)
    second = random.choice(string.ascii_uppercase + string.digits)
    digits = "".join(random.choice(string.digits) for _ in range(6))
    body = first + second + digits
    # 校验：权重 [9,8,7,6,5,4,3,2]（首字母按 A=10 起）
    weights = [9, 8, 7, 6, 5, 4, 3, 2]
    total = 0
    chars = [first]
    if second.isdigit():
        chars.append(second)
    else:
        total += (ord(second) - 55) * weights[1]
        chars.insert(1, "0")
    total += (ord(first) - 64 + 1) * weights[0] - 1  # A=10 起，已含在公式
    # 简化：直接使用常见生成库风格，计算第 2 位字母权重
    total = 0
    total += (ord(first) - 64 + 1) * weights[0]
    if second.isdigit():
        total += int(second) * weights[1]
    else:
        total += (ord(second) - 64 + 1) * weights[1]
    for i, c in enumerate(digits):
        total += int(c) * weights[i + 2]
    remainder = total % 11
    check = "0A23456789" if remainder == 10 else str(remainder)
    return f"{body}({check})"


def gen_license(_p: dict) -> str:
    """营业执照（统一社会信用代码）：18 位，GB 32100-2015 结构"""
    reg = random.choice(["91", "92", "91", "91"])
    region = random.choice(_REGION_CODES)
    body = (
        reg
        + region
        + _INSURANCE_CODE
        + "".join(
            random.choice(string.ascii_uppercase + string.digits) for _ in range(1)
        )
    )
    # 补齐到 17 位主体部分
    while len(body) < 17:
        body += random.choice(string.ascii_uppercase + string.digits)
    weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
    chars = "0123456789ABCDEFGHJKLMNPQRTUWXY"
    total = sum(chars.index(body[i]) * weights[i] for i in range(17))
    return body + chars[(31 - total % 31) % 31]


def gen_geo(_p: dict) -> str:
    """经纬度：中国大陆范围内坐标（6 位小数）"""
    lat = round(random.uniform(18.0, 53.5), 6)
    lng = round(random.uniform(73.5, 135.0), 6)
    return f"{lat}, {lng}"


def gen_username(_p: dict) -> str:
    """用户名：常见前缀 + 数字/字母后缀"""
    return (
        random.choice(_LLM_PREFIX)
        + random.choice(_LLM_SUFFIX)
        + "".join(random.choice(string.digits) for _ in range(random.randint(1, 3)))
    )


# ════════════ 生成器注册表 ════════════

GENERATORS = [
    {
        "key": "cn_name",
        "name": "中文姓名",
        "description": "百家姓 + 常用名组合，长度 2~3 字",
        "example": "张伟",
        "fields": ["姓名"],
    },
    {
        "key": "phone",
        "name": "手机号码",
        "description": "大陆 11 位手机号，真实运营商号段",
        "example": "138****1234",
        "fields": ["手机号"],
    },
    {
        "key": "email",
        "name": "电子邮箱",
        "description": "随机前缀 + 常见邮箱域名",
        "example": "test2024@163.com",
        "fields": ["邮箱"],
    },
    {
        "key": "address",
        "name": "中文地址",
        "description": "省市区 + 街道 + 门牌号的完整地址",
        "example": "浙江省杭州市西湖区科技路88号",
        "fields": ["地址"],
    },
    {
        "key": "id_card",
        "name": "身份证号",
        "description": "18 位身份证号，含合法校验位",
        "example": "110101198001011234",
        "fields": ["身份证号"],
    },
    {
        "key": "company",
        "name": "公司名称",
        "description": "字号 + 行业 + 组织形式组合",
        "example": "中科信息技术有限公司",
        "fields": ["公司名"],
    },
    {
        "key": "bank_card",
        "name": "银行卡号",
        "description": "16~19 位银行卡号，Luhn 校验合法",
        "example": "6222****1234",
        "fields": ["卡号"],
    },
    {
        "key": "hk_id",
        "name": "香港身份证",
        "description": "字母 + 数字 + 括号校验位格式",
        "example": "A123456(7)",
        "fields": ["证件号"],
    },
    {
        "key": "license",
        "name": "营业执照号",
        "description": "18 位统一社会信用代码（GB 32100-2015）",
        "example": "91330106MA27X1234X",
        "fields": ["信用代码"],
    },
    {
        "key": "geo",
        "name": "经纬度坐标",
        "description": "中国大陆范围内经纬度（6 位小数）",
        "example": "30.274084, 120.155070",
        "fields": ["纬度", "经度"],
    },
    {
        "key": "username",
        "name": "用户名",
        "description": "常见英文前缀 + 数字后缀",
        "example": "test0707",
        "fields": ["用户名"],
    },
]
_GEN_FUNCS = {
    "cn_name": gen_cn_name,
    "phone": gen_phone,
    "email": gen_email,
    "address": gen_address,
    "id_card": gen_id_card,
    "company": gen_company,
    "bank_card": gen_bank_card,
    "hk_id": gen_hk_id,
    "license": gen_license,
    "geo": gen_geo,
    "username": gen_username,
}


@router.get("/generators", response_model=ResponseModel)
async def list_generators(
    user: User = Depends(get_current_user_dep),
):
    """生成器列表（含说明与示例）"""
    return ResponseModel(data=GENERATORS)


@router.post("/generate", response_model=ResponseModel)
async def generate(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """批量生成数据：{generator, count}，生成前 5 条预览并写入历史"""
    gen_key = body.get("generator")
    count = max(1, min(int(body.get("count") or 10), 200))
    if gen_key not in _GEN_FUNCS:
        return ResponseModel(success=False, message="未知的生成器", data=None)

    func_ = _GEN_FUNCS[gen_key]
    meta = next((g for g in GENERATORS if g["key"] == gen_key), {})
    rows = [{"value": func_(body.get("params") or {})} for _ in range(count)]
    # 同步写入历史（数据量小，直接落库）
    log = DataFactoryLog(
        generator=gen_key,
        generator_name=meta.get("name", gen_key),
        count=count,
        params=body.get("params") or {},
        preview={"rows": [r["value"] for r in rows[:5]]},
        created_by=user.id,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return ResponseModel(
        message=f"已生成 {count} 条{meta.get('name', '')}数据",
        data={"rows": rows, "log_id": log.id, "total": count},
    )


@router.get("/logs", response_model=ResponseModel)
async def list_logs(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """生成历史记录"""
    q = select(DataFactoryLog).where(DataFactoryLog.created_by == user.id)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    q = (
        q.order_by(desc(DataFactoryLog.id))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()
    items = [
        {
            "id": m.id,
            "generator": m.generator,
            "generator_name": m.generator_name,
            "count": m.count,
            "params": m.params,
            "preview": (m.preview or {}).get("rows", []),
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M")
            if m.created_at
            else "",
        }
        for m in rows
    ]
    return ResponseModel(
        data={"total": total or 0, "page": page, "page_size": page_size, "items": items}
    )


@router.delete("/logs/{log_id}", response_model=ResponseModel)
async def delete_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除生成历史"""
    item = await db.get(DataFactoryLog, log_id)
    if not item or item.created_by != user.id:
        return ResponseModel(success=False, message="记录不存在", data=None)
    await db.delete(item)
    await db.commit()
    return ResponseModel(message="记录已删除")
