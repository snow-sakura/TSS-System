"""
Playwright MCP Server 启动器

启动 @playwright/mcp 作为子进程，提供 MCP 协议浏览器自动化服务。

用法:
    python -m backend.scripts.start_mcp_server [--port 8931] [--headless]

    启动后可通过 SSE 连接: http://localhost:8931/sse
    或 stdio: npx @playwright/mcp (默认)
"""

import asyncio
import argparse
import signal
import sys
from pathlib import Path


async def start_stdio_server():
    """通过 stdio 启动 Playwright MCP Server（嵌入模式）"""
    import subprocess

    # 确保在 backend 目录运行（node_modules 所在目录）
    backend_dir = Path(__file__).resolve().parent.parent
    cmd = ["npx", "@playwright/mcp"]

    print(f"[MCP] 启动: {' '.join(cmd)}")
    print(f"[MCP] 工作目录: {backend_dir}")

    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(backend_dir),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    print(f"[MCP] 已启动 (PID: {process.pid})")

    async def read_stdout():
        async for line in process.stdout:
            print(f"[MCP:stdout] {line.decode().strip()}")

    async def read_stderr():
        async for line in process.stderr:
            print(f"[MCP:stderr] {line.decode().strip()}")

    await asyncio.gather(read_stdout(), read_stderr())
    await process.wait()
    print(f"[MCP] 进程退出 (returncode={process.returncode})")


async def start_sse_server(port: int = 8931, headless: bool = True):
    """通过 SSE 传输启动 Playwright MCP Server"""
    import subprocess

    backend_dir = Path(__file__).resolve().parent.parent
    cmd = [
        "npx", "@playwright/mcp",
        "--port", str(port),
    ]
    if headless:
        cmd.append("--headless")

    print(f"[MCP] 启动 SSE Server: {' '.join(cmd)}")
    print(f"[MCP] 监听端口: {port}")

    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(backend_dir),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    print(f"[MCP] 已启动 (PID: {process.pid})")

    async def read_stdout():
        async for line in process.stdout:
            text = line.decode().strip()
            print(f"[MCP] {text}")

    async def read_stderr():
        async for line in process.stderr:
            text = line.decode().strip()
            print(f"[MCP] {text}")

    await asyncio.gather(read_stdout(), read_stderr())
    await process.wait()
    print(f"[MCP] 进程退出 (returncode={process.returncode})")


def main():
    parser = argparse.ArgumentParser(description="Playwright MCP Server 启动器")
    parser.add_argument("--port", type=int, default=8931, help="SSE 端口 (默认: 8931)")
    parser.add_argument("--headless", action="store_true", default=True, help="无头模式")
    parser.add_argument("--transport", choices=["stdio", "sse"], default="sse", help="传输方式 (默认: sse)")

    args = parser.parse_args()

    print("=" * 50)
    print("Playwright MCP Server")
    print("=" * 50)
    print(f"  传输方式: {args.transport}")
    if args.transport == "sse":
        print(f"  端口:     {args.port}")
        print(f"  SSE URL:  http://localhost:{args.port}/sse")
    print(f"  无头模式: {args.headless}")
    print("=" * 50)
    print("  按 Ctrl+C 停止")
    print()

    try:
        if args.transport == "sse":
            asyncio.run(start_sse_server(port=args.port, headless=args.headless))
        else:
            asyncio.run(start_stdio_server())
    except KeyboardInterrupt:
        print("\n[MCP] 用户中断")
        sys.exit(0)


if __name__ == "__main__":
    main()
