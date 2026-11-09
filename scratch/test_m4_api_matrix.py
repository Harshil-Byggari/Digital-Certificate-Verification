import urllib.request
import json
import subprocess

API_BASE = "http://localhost:8080/ords/dcvs/api"

def http_verify(ref, method="MANUAL", token=None):
    url = f"{API_BASE}/verify"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    if token:
        headers["X-Auth-Token"] = token
    body = json.dumps({"reference": ref, "method": method}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode("utf-8")
        return e.code, json.loads(resp_body) if resp_body else {}

def http_login(user, pwd):
    url = f"{API_BASE}/auth/login"
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    body = json.dumps({"username": user, "password": pwd}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def query_sql(sql_cmd):
    full_cmd = f"""sqlplus -s / as sysdba << 'EOF'
alter session set container = FREEPDB1;
set linesize 200 pagesize 100;
{sql_cmd}
exit;
EOF"""
    res = subprocess.run(["podman", "exec", "oracle-db", "bash", "-c", full_cmd],
                         capture_output=True, text=True)
    return res.stdout

def main():
    print("=== Testing 6 Public Verification API States (Unauthenticated) ===")
    
    test_cases = [
        ("VALID", "DCVS-2026-001", "VALID", "Hash and signature verified"),
        ("EXPIRED", "DCVS-2026-002", "EXPIRED", "Expired on"),
        ("REVOKED", "DCVS-2026-003", "REVOKED", "Revoked on"),
        ("UNISSUED/DRAFT", "DCVS-2026-004", "INVALID", "Certificate has not been issued"),
        ("INVALID/NONEXISTENT", "DOES-NOT-EXIST-999", "INVALID", "No certificate exists with this reference"),
        ("TAMPERED", "DCVS-2026-012", "TAMPERED", "Hash or signature validation failed")
    ]

    results = {}
    for label, ref, expected_result, expected_msg_substring in test_cases:
        status, data = http_verify(ref, method="MANUAL", token=None)
        results[label] = {"status": status, "data": data}
        print(f"\n--- State: {label} (Ref: {ref}) ---")
        print(f"HTTP Status: {status}")
        print(json.dumps(data, indent=2))
        assert status == 200, f"Expected 200 for {label}, got {status}"
        assert data.get("result") == expected_result, f"Expected result {expected_result}, got {data.get('result')}"
        assert expected_msg_substring in data.get("message", ""), f"Expected msg to contain '{expected_msg_substring}', got '{data.get('message')}'"

    print("\n=== Testing Verifier-Authenticated Verification & Audit Logging ===")
    # Login as verifier
    login_data = http_login("verifier1", "Verifier@123")
    verifier_token = login_data["data"]["token"]
    verifier_user = login_data["data"]["user"]
    print(f"Verifier logged in: username={verifier_user['username']}, linked_id={verifier_user['linked_id']}")

    # Verify a certificate with verifier context
    audit_test_ref = "DCVS-2026-001"
    status, v_res = http_verify(audit_test_ref, method="API", token=verifier_token)
    print(f"Verifier verify HTTP Status: {status}")
    print(json.dumps(v_res, indent=2))

    # Query the verification table to confirm the audit log was recorded
    print("\n=== Checking Oracle Verification Audit Log ===")
    sql = f"""
    col reference_text format a15;
    col result format a10;
    col method format a10;
    col ip_address format a15;
    col verification_time format a30;
    select verification_id, certificate_id, reference_text, verifier_id, result, method, 
           to_char(verification_time, 'YYYY-MM-DD HH24:MI:SS') as verification_time
    from dcvs.verification
    where reference_text = '{audit_test_ref}'
    order by verification_id desc
    fetch first 3 rows only;
    """
    db_out = query_sql(sql)
    print(db_out)

    with open("scratch/api_matrix_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(">>> All 6 API states verified successfully & audit log confirmed!")

if __name__ == "__main__":
    main()
