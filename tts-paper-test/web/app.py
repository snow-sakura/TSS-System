"""Flask Web Application for TSS Paper Test"""

import json
import sys
from datetime import datetime
from pathlib import Path
from threading import Thread

from flask import Flask, render_template, request, jsonify, send_file

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

app = Flask(__name__)
app.secret_key = 'tss-paper-test-secret-key'

# Store for real-time status
test_status = {
    "running": False,
    "last_run": None,
    "progress": 0,
    "current_phase": None,
    "results": None
}


@app.route('/')
def dashboard():
    """Main dashboard page"""
    return render_template('dashboard.html', status=test_status)


@app.route('/test-generation')
def test_generation():
    """Test generation page"""
    return render_template('test_generation.html', status=test_status)


@app.route('/test-execution')
def test_execution():
    """Test execution page"""
    return render_template('test_execution.html', status=test_status)


@app.route('/test-analysis')
def test_analysis():
    """Test analysis page"""
    return render_template('test_analysis.html', status=test_status)


@app.route('/knowledge')
def knowledge():
    """Knowledge base management page"""
    return render_template('knowledge.html', status=test_status)


@app.route('/settings')
def settings():
    """Settings page"""
    return render_template('settings.html', status=test_status)


# ===== API Endpoints =====

@app.route('/api/status')
def api_status():
    """Get current test status"""
    return jsonify(test_status)


@app.route('/api/stats')
def api_stats():
    """Get knowledge base statistics"""
    try:
        from knowledge.vector_store import knowledge_store
        stats = knowledge_store.get_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/generate', methods=['POST'])
def api_generate():
    """Generate tests"""
    if test_status["running"]:
        return jsonify({"error": "Test already running"}), 400
    
    data = request.get_json()
    module = data.get('module', None)
    
    def run_generation():
        global test_status
        test_status["running"] = True
        test_status["current_phase"] = "Generating tests"
        test_status["progress"] = 0
        
        try:
            from agents.skills_integration import skills_integration
            result = skills_integration.test_generation(module)
            test_status["results"] = result
            test_status["last_run"] = datetime.now().isoformat()
        except Exception as e:
            test_status["results"] = {"error": str(e)}
        finally:
            test_status["running"] = False
            test_status["progress"] = 100
            test_status["current_phase"] = None
    
    thread = Thread(target=run_generation)
    thread.start()
    
    return jsonify({"message": "Test generation started"})


@app.route('/api/execute', methods=['POST'])
def api_execute():
    """Execute tests"""
    if test_status["running"]:
        return jsonify({"error": "Test already running"}), 400
    
    def run_execution():
        global test_status
        test_status["running"] = True
        test_status["current_phase"] = "Executing tests"
        test_status["progress"] = 0
        
        try:
            from agents.skills_integration import skills_integration
            result = skills_integration.test_execution()
            test_status["results"] = result
            test_status["last_run"] = datetime.now().isoformat()
        except Exception as e:
            test_status["results"] = {"error": str(e)}
        finally:
            test_status["running"] = False
            test_status["progress"] = 100
            test_status["current_phase"] = None
    
    thread = Thread(target=run_execution)
    thread.start()
    
    return jsonify({"message": "Test execution started"})


@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    """Analyze results"""
    try:
        from agents.skills_integration import skills_integration
        result = skills_integration.test_analysis()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/knowledge', methods=['GET'])
def api_knowledge():
    """Get knowledge base data"""
    try:
        from knowledge.vector_store import knowledge_store
        
        patterns = knowledge_store.get_all_patterns()
        bugs = knowledge_store.get_all_bugs()
        stats = knowledge_store.get_stats()
        
        return jsonify({
            "patterns": patterns,
            "bugs": bugs,
            "stats": stats
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/knowledge/pattern', methods=['POST'])
def api_add_pattern():
    """Add a test pattern"""
    try:
        data = request.get_json()
        from knowledge.vector_store import knowledge_store
        
        knowledge_store.add_test_pattern({
            "id": data.get('id', f"pattern-{datetime.now().timestamp()}"),
            "description": data.get('description', ''),
            "metadata": data.get('metadata', {})
        })
        
        return jsonify({"message": "Pattern added successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/knowledge/bug', methods=['POST'])
def api_add_bug():
    """Add bug knowledge"""
    try:
        data = request.get_json()
        from knowledge.vector_store import knowledge_store
        
        knowledge_store.add_bug_knowledge({
            "id": data.get('id', f"bug-{datetime.now().timestamp()}"),
            "description": data.get('description', ''),
            "metadata": data.get('metadata', {})
        })
        
        return jsonify({"message": "Bug knowledge added successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/reports')
def api_reports():
    """Get list of reports"""
    try:
        reports_dir = project_root / "reports"
        reports = []
        
        if reports_dir.exists():
            for f in reports_dir.glob("*.json"):
                reports.append({
                    "name": f.name,
                    "path": str(f),
                    "created": datetime.fromtimestamp(f.stat().st_ctime).isoformat()
                })
        
        return jsonify({"reports": reports})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/reports/<filename>')
def api_report(filename):
    """Get a specific report"""
    try:
        reports_dir = project_root / "reports"
        report_path = reports_dir / filename
        
        if report_path.exists():
            with open(report_path, 'r') as f:
                report = json.load(f)
            return jsonify(report)
        else:
            return jsonify({"error": "Report not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
