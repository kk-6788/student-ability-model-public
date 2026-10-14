"""重新执行已审阅的固定规格；不解析或执行内容包提供的表达式。"""
import runpy
import sys
from pathlib import Path

root=Path(__file__).resolve().parent
local_deps=root.parents[1]/'work'/'math-verifier-deps'
if local_deps.exists():sys.path.insert(0,str(local_deps))
try:
    import sympy
except ImportError:
    raise SystemExit('开发复算需要现有 SymPy Python 环境；普通网页使用不需要。脚本不会自动安装软件。')
for n in (1,2,3):
    runpy.run_path(str(root/'核验材料'/f'verify-batch-{n}.py'),run_name='__main__')
print('PASS: fixed-spec computations rerun; logic-only items still rely on the supplied reasoning reviews.')

