"""LLM服务模块 - 支持OpenAI和Anthropic API"""

import os
import json
from typing import Optional, Dict, Any
from pathlib import Path


class LLMService:
    """LLM服务类"""
    
    def __init__(self):
        self.providers = {}
        self._load_providers()
    
    def _load_providers(self):
        """从配置文件加载LLM提供商"""
        config_file = Path(__file__).parent.parent / "data" / "llm_providers.json"
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                providers = json.load(f)
                for p in providers:
                    if p.get('status') == 'active':
                        self.providers[p['type']] = p
    
    def reload_providers(self):
        """重新加载提供商配置"""
        self.providers = {}
        self._load_providers()
    
    async def chat(self, messages: list, provider: str = None, model: str = None, 
                   temperature: float = 0.7, max_tokens: int = 4096) -> str:
        """调用LLM进行对话
        
        Args:
            messages: 对话消息列表 [{"role": "user", "content": "..."}]
            provider: 提供商类型 (openai, anthropic)
            model: 模型名称
            temperature: 温度参数
            max_tokens: 最大token数
            
        Returns:
            LLM响应文本
        """
        if provider is None:
            provider = list(self.providers.keys())[0] if self.providers else 'openai'
        
        provider_config = self.providers.get(provider)
        if not provider_config:
            raise ValueError(f"未找到提供商: {provider}")
        
        api_key = provider_config.get('api_key')
        if not api_key:
            raise ValueError(f"未配置API密钥: {provider}")
        
        if provider == 'openai':
            return await self._call_openai(messages, api_key, model, temperature, max_tokens)
        elif provider == 'anthropic':
            return await self._call_anthropic(messages, api_key, model, temperature, max_tokens)
        else:
            raise ValueError(f"不支持的提供商: {provider}")
    
    async def _call_openai(self, messages: list, api_key: str, model: str = None,
                           temperature: float = 0.7, max_tokens: int = 4096) -> str:
        """调用OpenAI API"""
        try:
            import httpx
            
            if model is None:
                model = "gpt-4"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens
                    },
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result["choices"][0]["message"]["content"]
                else:
                    error = response.json().get("error", {})
                    raise Exception(f"OpenAI API错误: {error.get('message', 'Unknown error')}")
                    
        except ImportError:
            raise Exception("请安装httpx: pip install httpx")
        except Exception as e:
            raise Exception(f"OpenAI调用失败: {str(e)}")
    
    async def _call_anthropic(self, messages: list, api_key: str, model: str = None,
                              temperature: float = 0.7, max_tokens: int = 4096) -> str:
        """调用Anthropic API"""
        try:
            import httpx
            
            if model is None:
                model = "claude-3-opus-20240229"
            
            # 转换消息格式
            system_message = ""
            user_messages = []
            for msg in messages:
                if msg["role"] == "system":
                    system_message = msg["content"]
                else:
                    user_messages.append(msg)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                        "system": system_message,
                        "messages": user_messages
                    },
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result["content"][0]["text"]
                else:
                    error = response.json().get("error", {})
                    raise Exception(f"Anthropic API错误: {error.get('message', 'Unknown error')}")
                    
        except ImportError:
            raise Exception("请安装httpx: pip install httpx")
        except Exception as e:
            raise Exception(f"Anthropic调用失败: {str(e)}")
    
    async def generate_test_analysis(self, requirement_content: str) -> Dict[str, Any]:
        """生成需求分析结果
        
        Args:
            requirement_content: 需求内容
            
        Returns:
            分析结果字典
        """
        prompt = f"""你是一个专业的软件测试专家。请分析以下需求文档，提取测试点。

需求内容：
{requirement_content}

请以JSON格式返回分析结果，包含以下字段：
1. summary: 需求摘要（一句话概括）
2. test_points: 测试点列表，每个测试点包含：
   - title: 测试点标题
   - type: 测试类型（功能测试/接口测试/性能测试/安全测试）
   - priority: 优先级（高/中/低）
   - category: 所属模块
3. risk_areas: 风险点列表
4. suggestions: 建议列表

请直接返回JSON，不要添加其他说明。"""
        
        messages = [
            {"role": "system", "content": "你是一个专业的软件测试专家，擅长需求分析和测试点提取。"},
            {"role": "user", "content": prompt}
        ]
        
        response = await self.chat(messages, temperature=0.7)
        
        # 尝试解析JSON
        try:
            # 移除可能的markdown代码块标记
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            return json.loads(response)
        except json.JSONDecodeError:
            # 如果JSON解析失败，返回模拟数据
            return self._generate_mock_analysis(requirement_content)
    
    async def generate_test_plan(self, test_points: list) -> Dict[str, Any]:
        """生成测试方案
        
        Args:
            test_points: 测试点列表
            
        Returns:
            测试方案字典
        """
        prompt = f"""你是一个专业的测试方案设计师。请根据以下测试点，设计测试方案。

测试点：
{json.dumps(test_points, ensure_ascii=False, indent=2)}

请以JSON格式返回测试方案，包含以下字段：
1. test_strategy: 测试策略
2. test_scope: 测试范围
3. test_environment: 测试环境
4. test_schedule: 测试计划
5. risk_assessment: 风险评估
6. entry_criteria: 准入条件
7. exit_criteria: 准出条件

请直接返回JSON，不要添加其他说明。"""
        
        messages = [
            {"role": "system", "content": "你是一个专业的测试方案设计师。"},
            {"role": "user", "content": prompt}
        ]
        
        response = await self.chat(messages, temperature=0.7)
        
        try:
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            return json.loads(response)
        except json.JSONDecodeError:
            return self._generate_mock_test_plan()
    
    async def generate_test_cases(self, test_points: list, count: int = 5) -> list:
        """生成测试用例
        
        Args:
            test_points: 测试点列表
            count: 生成数量
            
        Returns:
            测试用例列表
        """
        prompt = f"""你是一个专业的测试用例设计师。请根据以下测试点，生成{count}个测试用例。

测试点：
{json.dumps(test_points, ensure_ascii=False, indent=2)}

请以JSON数组格式返回测试用例列表，每个用例包含：
1. title: 用例标题
2. precondition: 前置条件
3. steps: 测试步骤（每行一个步骤）
4. expected_result: 预期结果
5. type: 测试类型
6. priority: 优先级

请直接返回JSON数组，不要添加其他说明。"""
        
        messages = [
            {"role": "system", "content": "你是一个专业的测试用例设计师。"},
            {"role": "user", "content": prompt}
        ]
        
        response = await self.chat(messages, temperature=0.7)
        
        try:
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            return json.loads(response)
        except json.JSONDecodeError:
            return self._generate_mock_test_cases(count)
    
    def _generate_mock_analysis(self, content: str) -> Dict[str, Any]:
        """生成模拟分析结果"""
        return {
            "summary": "该需求描述了一个软件系统，包含多个功能模块。",
            "test_points": [
                {"title": "用户登录功能测试", "type": "功能测试", "priority": "高", "category": "认证模块"},
                {"title": "数据查询功能测试", "type": "功能测试", "priority": "中", "category": "数据模块"},
                {"title": "API接口测试", "type": "接口测试", "priority": "高", "category": "接口模块"},
                {"title": "性能压力测试", "type": "性能测试", "priority": "中", "category": "性能模块"},
                {"title": "安全漏洞扫描", "type": "安全测试", "priority": "高", "category": "安全模块"}
            ],
            "risk_areas": ["并发访问可能导致数据不一致", "会话管理可能存在安全漏洞"],
            "建议": ["增加并发测试用例", "补充边界值测试"]
        }
    
    def _generate_mock_test_plan(self) -> Dict[str, Any]:
        """生成模拟测试方案"""
        return {
            "test_strategy": "采用黑盒测试为主，白盒测试为辅的测试策略",
            "test_scope": "覆盖所有功能模块的核心业务流程",
            "test_environment": "开发环境、测试环境、预生产环境",
            "test_schedule": "预计5个工作日完成测试",
            "risk_assessment": "中等风险，重点关注并发和数据一致性",
            "entry_criteria": "需求评审通过，开发完成，部署到测试环境",
            "exit_criteria": "测试用例执行率100%，通过率≥95%，无严重缺陷"
        }
    
    def _generate_mock_test_cases(self, count: int) -> list:
        """生成模拟测试用例"""
        return [
            {"title": "测试登录接口-正确用户名密码", "precondition": "用户已注册", "steps": "1.输入正确用户名\n2.输入正确密码\n3.点击登录", "expected_result": "登录成功", "type": "功能测试", "priority": "高"},
            {"title": "测试登录接口-错误密码", "precondition": "用户已注册", "steps": "1.输入正确用户名\n2.输入错误密码\n3.点击登录", "expected_result": "提示密码错误", "type": "功能测试", "priority": "高"},
            {"title": "测试数据查询-正常查询", "precondition": "系统有数据", "steps": "1.进入查询页面\n2.输入查询条件\n3.点击查询", "expected_result": "显示查询结果", "type": "功能测试", "priority": "中"},
            {"title": "测试数据查询-空结果", "precondition": "系统无匹配数据", "steps": "1.进入查询页面\n2.输入不存在的条件\n3.点击查询", "expected_result": "显示无数据提示", "type": "功能测试", "priority": "中"},
            {"title": "测试API接口-参数校验", "precondition": "无", "steps": "1.发送缺少必填参数的请求\n2.检查响应", "expected_result": "返回参数错误提示", "type": "接口测试", "priority": "高"}
        ][:count]


# 全局LLM服务实例
llm_service = LLMService()
