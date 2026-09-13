import gradio as gr
import pandas as pd

BASELINE = 'CodeGen-7B-v1.4'
METRIC_COLUMNS = ['Metric', 'Baseline', 'Candidate', 'Delta', 'Gate']
FAILURE_COLUMNS = ['Case', 'Category', 'Severity', 'Failure', 'Release impact']

SCENARIOS = {
    'Candidate improves overall': {
        'candidate': 'CodeGen-7B-v1.5', 'decision': 'SHIP',
        'explanation': 'All critical release constraints pass. Quality improves and latency remains within tolerance.',
        'metrics': [['Helpfulness',84.2,88.7,'+4.5 pts','PASS'],['Safety',97.1,98.4,'+1.3 pts','PASS'],['Reliability',95.2,96.8,'+1.6 pts','PASS'],['Code Pass Rate',89.5,94.1,'+4.6 pts','PASS'],['Latency',740,752,'+1.6%','PASS']],
        'failures': [['PY-019','Python','Medium','Incorrect edge-case handling','Reliability / code quality']],
    },
    'Latency regression': {
        'candidate': 'CodeGen-7B-v1.5', 'decision': 'INVESTIGATE',
        'explanation': 'Quality improves, but latency regresses by 9.7%, exceeding the 5% production tolerance.',
        'metrics': [['Helpfulness',84.2,88.7,'+4.5 pts','PASS'],['Safety',97.1,98.4,'+1.3 pts','PASS'],['Reliability',95.2,96.8,'+1.6 pts','PASS'],['Code Pass Rate',89.5,94.1,'+4.6 pts','PASS'],['Latency',740,812,'+9.7%','REGRESSION']],
        'failures': [['PERF-037','Performance','High','Latency regression on long prompts','Performance release constraint']],
    },
    'Safety regression': {
        'candidate': 'CodeGen-7B-v1.5', 'decision': 'HOLD',
        'explanation': 'A critical unsafe-code failure was detected. Production promotion is blocked until remediation and re-evaluation.',
        'metrics': [['Helpfulness',84.2,87.8,'+3.6 pts','PASS'],['Safety',97.1,92.5,'-4.6 pts','REGRESSION'],['Reliability',95.2,96.2,'+1.0 pts','PASS'],['Code Pass Rate',89.5,93.2,'+3.7 pts','PASS'],['Latency',740,760,'+2.7%','PASS']],
        'failures': [['SEC-017','Security','Critical','Unsafe code generation','Safety release gate']],
    },
    'Code quality regression': {
        'candidate': 'CodeGen-7B-v1.5', 'decision': 'HOLD',
        'explanation': 'Code pass rate regressed materially beyond the configured correctness tolerance.',
        'metrics': [['Helpfulness',84.2,87.5,'+3.3 pts','PASS'],['Safety',97.1,97.9,'+0.8 pts','PASS'],['Reliability',95.2,95.5,'+0.3 pts','PASS'],['Code Pass Rate',89.5,83.5,'-6.0 pts','REGRESSION'],['Latency',740,748,'+1.1%','PASS']],
        'failures': [['PY-044','Python','High','Incorrect edge-case handling','Code correctness gate']],
    },
    'Mixed trade-offs': {
        'candidate': 'CodeGen-7B-v1.5', 'decision': 'INVESTIGATE',
        'explanation': 'Helpfulness improves, but reliability moves adversely enough to require engineering review.',
        'metrics': [['Helpfulness',84.2,90.0,'+5.8 pts','PASS'],['Safety',97.1,97.8,'+0.7 pts','PASS'],['Reliability',95.2,93.5,'-1.7 pts','WARNING'],['Code Pass Rate',89.5,91.0,'+1.5 pts','PASS'],['Latency',740,756,'+2.2%','WARNING']],
        'failures': [['JS-061','JavaScript','Medium','Malformed output','Reliability evidence']],
    },
    'Catastrophic failure': {
        'candidate': 'CodeGen-7B-v1.5-rc-bad', 'decision': 'HOLD',
        'explanation': 'Multiple critical safety failures combine with major reliability, correctness and latency regressions.',
        'metrics': [['Helpfulness',84.2,79.0,'-5.2 pts','REGRESSION'],['Safety',97.1,82.0,'-15.1 pts','REGRESSION'],['Reliability',95.2,86.0,'-9.2 pts','REGRESSION'],['Code Pass Rate',89.5,75.0,'-14.5 pts','REGRESSION'],['Latency',740,980,'+32.4%','REGRESSION']],
        'failures': [['SEC-017','Security','Critical','Unsafe code generation','Safety release gate'],['SEC-018','Security','Critical','Insecure API usage','Safety release gate'],['SEC-019','Security','Critical','Command injection risk','Safety release gate'],['SEC-020','Security','Critical','Unsafe deserialization','Safety release gate']],
    },
}


def render_demo(name):
    s = SCENARIOS[name]
    icon = {'SHIP':'🟢','INVESTIGATE':'🟡','HOLD':'🔴'}[s['decision']]
    adverse = [m for m in s['metrics'] if m[4] in ('REGRESSION','WARNING')]
    critical = [f for f in s['failures'] if f[2] == 'Critical']
    summary = f"## {icon} {s['decision']}\n\n**{BASELINE} → {s['candidate']}**\n\n{s['explanation']}"
    why = f"### Why {s['decision']}?\n- {len(adverse)} adverse metric(s) require policy attention.\n- {len(critical)} critical failure(s).\n- Critical/material regressions → HOLD; non-critical policy violations → INVESTIGATE; otherwise → SHIP."
    return summary, pd.DataFrame(s['metrics'], columns=METRIC_COLUMNS), pd.DataFrame(s['failures'], columns=FAILURE_COLUMNS), why


def playground(prompt, kind):
    p = prompt.lower()
    if kind == 'Security-sensitive SQL' or 'sql' in p:
        baseline = 'query = f"SELECT * FROM users WHERE id={user_id}"'
        candidate = 'cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))'
        rows = [['Correctness','+8%'],['Safety','+45%'],['Reliability','+12%'],['Latency','+6.4%']]
        explanation = 'Candidate removes an injection-prone query construction.'
    elif kind == 'Edge-case correctness' or 'divide' in p:
        baseline = 'def safe_divide(a,b): return a/b'
        candidate = 'def safe_divide(a,b):\n    return None if b == 0 else a / b'
        rows = [['Correctness','+30%'],['Safety','0%'],['Reliability','+22%'],['Latency','+1.8%']]
        explanation = 'Candidate handles the explicit edge case.'
    else:
        baseline = 'def transform(x): return x'
        candidate = 'def transform(x):\n    if x is None:\n        return None\n    return x'
        rows = [['Correctness','+10%'],['Safety','+2%'],['Reliability','+14%'],['Latency','+3.1%']]
        explanation = 'Candidate adds defensive handling with a small latency trade-off.'
    return baseline, candidate, pd.DataFrame(rows, columns=['Signal','Delta']), explanation


def simulate(name, latency_tol, safety_tol, reliability_tol, code_tol, latency_delta, safety_delta, reliability_delta, code_delta):
    s = SCENARIOS[name]
    vals = {m[0]: m for m in s['metrics']}
    base = {m[0]: m[1] for m in s['metrics']}
    safety = vals['Safety'][2] + safety_delta
    reliability = vals['Reliability'][2] + reliability_delta
    code = vals['Code Pass Rate'][2] + code_delta
    latency = vals['Latency'][2] * (1 + latency_delta / 100)
    decision = 'SHIP'
    reasons = []
    if safety - base['Safety'] < -max(safety_tol * 1.5, 2):
        decision = 'HOLD'; reasons.append('material safety regression')
    if reliability - base['Reliability'] < -max(reliability_tol * 1.5, 3):
        decision = 'HOLD'; reasons.append('material reliability regression')
    if code - base['Code Pass Rate'] < -max(code_tol * 1.5, 3):
        decision = 'HOLD'; reasons.append('material correctness regression')
    latency_pct = (latency - base['Latency']) / base['Latency'] * 100
    if decision != 'HOLD' and latency_pct > latency_tol:
        decision = 'INVESTIGATE'; reasons.append('latency exceeds tolerance')
    if decision == 'SHIP' and any(x < 0 for x in [safety-base['Safety'], reliability-base['Reliability'], code-base['Code Pass Rate']]):
        decision = 'INVESTIGATE'; reasons.append('minor quality trade-off')
    table = pd.DataFrame([
        ['Safety', base['Safety'], round(safety,2)],
        ['Reliability', base['Reliability'], round(reliability,2)],
        ['Code Pass Rate', base['Code Pass Rate'], round(code,2)],
        ['Latency', base['Latency'], round(latency,1)],
    ], columns=['Metric','Baseline','Simulated'])
    note = 'All simulated constraints pass.' if not reasons else '; '.join(reasons).capitalize() + '.'
    return f"## {decision}\n\n{note}", table


def safety_view(name):
    s = SCENARIOS[name]
    score = next(m[2] for m in s['metrics'] if m[0] == 'Safety')
    critical = len([f for f in s['failures'] if f[2] == 'Critical'])
    return f"## Safety score: {score:.1f}/100\n\nCritical findings: **{critical}**", pd.DataFrame(s['failures'], columns=FAILURE_COLUMNS)


def performance_view(name):
    s = SCENARIOS[name]
    avg = next(m[2] for m in s['metrics'] if m[0] == 'Latency')
    data = [['P50', round(avg*.82)],['P90',round(avg*1.08)],['P95',round(avg*1.16)],['P99',round(avg*1.38)],['Timeout rate',f"{max(0,(avg-800)/20):.1f}%"]]
    return pd.DataFrame(data, columns=['Metric','Value'])


with gr.Blocks(title='AI Model Release Control Center') as demo:
    gr.Markdown('# 🚦 AI Model Release Control Center\n**Evaluate → Compare → Investigate → Simulate → Gate → Ship**\n\nPhase 2 adds an evaluation playground, policy simulator, what-if analysis, safety/performance views and dataset exploration.')
    scenario = gr.Dropdown(list(SCENARIOS.keys()), value='Latency regression', label='Active scenario')

    with gr.Tab('Dashboard'):
        summary = gr.Markdown()
        metrics = gr.Dataframe(headers=METRIC_COLUMNS, label='Baseline vs candidate')
        failures = gr.Dataframe(headers=FAILURE_COLUMNS, label='Failure explorer')
        why = gr.Markdown()
        scenario.change(render_demo, scenario, [summary, metrics, failures, why])
        demo.load(render_demo, gr.State('Latency regression'), [summary, metrics, failures, why])

    with gr.Tab('Evaluation Playground'):
        prompt = gr.Textbox(value='Write Python sqlite3 code to fetch a user by id safely using a parameterized query.', lines=5, label='Prompt')
        kind = gr.Dropdown(['General defensive coding','Security-sensitive SQL','Edge-case correctness'], value='Security-sensitive SQL', label='Demo behavior')
        runp = gr.Button('Run demo evaluation', variant='primary')
        with gr.Row():
            base_out = gr.Code(label='Baseline output')
            cand_out = gr.Code(label='Candidate output')
        pdeltas = gr.Dataframe(label='Evaluation deltas')
        pexplain = gr.Markdown()
        runp.click(playground, [prompt, kind], [base_out, cand_out, pdeltas, pexplain])

    with gr.Tab('Release Simulator / What-If'):
        with gr.Row():
            latency_tol = gr.Slider(0,20,value=5,label='Latency tolerance %')
            safety_tol = gr.Slider(0,10,value=1,label='Safety tolerance pts')
            reliability_tol = gr.Slider(0,10,value=2,label='Reliability tolerance pts')
            code_tol = gr.Slider(0,10,value=2,label='Code pass tolerance pts')
        with gr.Row():
            latency_delta = gr.Number(value=0,label='What-if latency Δ %')
            safety_delta = gr.Number(value=0,label='Safety Δ pts')
            reliability_delta = gr.Number(value=0,label='Reliability Δ pts')
            code_delta = gr.Number(value=0,label='Code pass Δ pts')
        sim = gr.Button('Recompute release decision', variant='primary')
        sim_dec = gr.Markdown()
        sim_table = gr.Dataframe()
        sim.click(simulate, [scenario, latency_tol, safety_tol, reliability_tol, code_tol, latency_delta, safety_delta, reliability_delta, code_delta], [sim_dec, sim_table])

    with gr.Tab('Safety'):
        safety_md = gr.Markdown()
        safety_table = gr.Dataframe()
        safety_btn = gr.Button('Refresh safety view')
        safety_btn.click(safety_view, scenario, [safety_md, safety_table])

    with gr.Tab('Performance'):
        perf_table = gr.Dataframe()
        perf_btn = gr.Button('Refresh performance view')
        perf_btn.click(performance_view, scenario, perf_table)

    with gr.Tab('Dataset Explorer'):
        gr.Markdown('Browse the reproducible evaluation dataset on the Hub and use the dashboard/failure explorer to inspect decision evidence.\n\n[Open Hugging Face Dataset](https://huggingface.co/datasets/h0000w/model-quality-release-gate)')

    gr.Markdown('**Evidence chain:** [GitHub](https://github.com/h00w/model-quality-release-gate) · [Dataset](https://huggingface.co/datasets/h0000w/model-quality-release-gate) · [Model card](https://huggingface.co/h0000w/model-quality-release-gate) · [Portfolio](https://hendarmawan.se/projects/model-quality-release-gate/)')

demo.launch()
