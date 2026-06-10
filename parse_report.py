import json
import sys
import os
import requests

def analyze_with_ai(failed_tests_data):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return "Lưu ý: Không tìm thấy GEMINI_API_KEY trong biến môi trường. Bỏ qua phân tích AI."
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    prompt = f"Bạn là một chuyên gia QA Automation. Hãy tóm tắt ngắn gọn (bằng tiếng Việt) nguyên nhân cốt lõi của các lỗi Automation Test sau. Phân loại xem lỗi nào do UI thay đổi, lỗi nào do mạng/API timeout. Nếu thông báo quá dài, hãy tóm tắt những điểm chính:\n\n{json.dumps(failed_tests_data, ensure_ascii=False, indent=2)}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        return result['candidates'][0]['content']['parts'][0]['text']
    except Exception as e:
        return f"Lỗi khi gọi API phân tích AI: {str(e)}"

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 parse_report.py <json_report_file>")
        return

    with open(sys.argv[1], 'r') as f:
        # Some injected stdout might be at the start of the file, let's find the first '{'
        content = f.read()
        start = content.find('{')
        if start == -1:
            print("No JSON found in file.")
            return
        data = json.loads(content[start:])
    
    suites = data.get('suites', [])
    passed = 0
    failed = 0
    skipped = 0
    flaky = 0
    failed_tests = []

    for suite in suites:
        # The file-level suite usually has a 'suites' or 'specs' array
        for spec in suite.get('specs', []):
            title = spec.get('title', '')
            # tests are in tests array (can have multiple runs/retries)
            tests = spec.get('tests', [])
            for test in tests:
                # get the status of the last run
                results = test.get('results', [])
                if not results:
                    continue
                last_result = results[-1]
                status = last_result.get('status')
                
                # if there are errors, collect them
                errors = last_result.get('errors', [])
                error_msgs = [err.get('message', '') for err in errors if err.get('message')]
                
                if status == 'passed':
                    passed += 1
                elif status == 'failed' or status == 'timedOut':
                    failed += 1
                    failed_tests.append({
                        'file': suite.get('title', ''),
                        'title': title,
                        'status': status,
                        'errors': error_msgs
                    })
                elif status == 'skipped':
                    skipped += 1
                elif status == 'flaky':
                    flaky += 1
                    
        # check child suites if any
        for child_suite in suite.get('suites', []):
            for spec in child_suite.get('specs', []):
                title = spec.get('title', '')
                tests = spec.get('tests', [])
                for test in tests:
                    results = test.get('results', [])
                    if not results:
                        continue
                    last_result = results[-1]
                    status = last_result.get('status')
                    errors = last_result.get('errors', [])
                    error_msgs = [err.get('message', '') for err in errors if err.get('message')]
                    if status == 'passed':
                        passed += 1
                    elif status == 'failed' or status == 'timedOut':
                        failed += 1
                        failed_tests.append({
                            'file': child_suite.get('title', ''),
                            'title': title,
                            'status': status,
                            'errors': error_msgs
                        })
                    elif status == 'skipped':
                        skipped += 1
                    elif status == 'flaky':
                        flaky += 1

    print(f"Total passed: {passed}")
    print(f"Total failed: {failed}")
    print(f"Total skipped: {skipped}")
    print(f"Total flaky: {flaky}")
    print("\n--- Failed Tests ---")
    for ft in failed_tests:
        print(f"File: {ft['file']} | Test: {ft['title']} | Status: {ft['status']}")
        for err in ft['errors']:
            # only print first 2 lines of the error to save space
            print(f"  Error: {' '.join(err.splitlines()[:2])}")
        print()

    if failed_tests:
        print("\n" + "="*50)
        print("🤖 AI TÓM TẮT LỖI (GEMINI):")
        print("="*50)
        ai_summary = analyze_with_ai(failed_tests)
        print(ai_summary)
        print("="*50)

if __name__ == '__main__':
    main()
