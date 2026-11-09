import urllib.request
import json
import subprocess
import sys

API_BASE = "http://localhost:8080/ords/dcvs/api"

def http_req(endpoint, method="GET", data=None, token=None):
    url = f"{API_BASE}{endpoint}"
    headers = {"Accept": "application/json"}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    if token:
        headers["X-Auth-Token"] = token
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, {"raw_error": err_body}

def run_sql(sql_cmd):
    full_cmd = f"""sqlplus -s / as sysdba << 'EOF'
alter session set container = FREEPDB1;
{sql_cmd}
commit;
exit;
EOF"""
    res = subprocess.run(["podman", "exec", "oracle-db", "bash", "-c", full_cmd],
                         capture_output=True, text=True)
    return res.stdout

def main():
    print("=== Step 1: Login as Admin ===")
    status, login_res = http_req("/auth/login", method="POST", data={"username": "admin", "password": "Admin@1234"})
    assert status == 200, f"Login failed: {login_res}"
    token = login_res["data"]["token"]
    print("Admin logged in. Token acquired.")

    print("\n=== Step 2: Create Isolated Test Certificate ===")
    create_payload = {
        "title": "Crypto Tamper Verification Test",
        "applicant_id": 1,
        "type_id": 4,
        "issuer_id": 3,
        "issue_date": "2026-11-01",
        "expiry_date": None,
        "document_url": "https://example.com/crypto-test.pdf",
        "upload_certificate": None
    }
    status, create_res = http_req("/certificates", method="POST", data=create_payload, token=token)
    assert status in (200, 201), f"Create failed: {create_res}"
    cert_data = create_res["data"]
    cert_id = cert_data["certificate_id"]
    cert_no = cert_data["certificate_no"]
    print(f"Created Certificate ID={cert_id}, No={cert_no}")

    print("\n=== Step 3: Issue Certificate ===")
    status, issue_res = http_req(f"/certificates/{cert_id}/issue", method="POST", token=token)
    assert status in (200, 201), f"Issue failed: {issue_res}"
    issued_cert = issue_res["data"]
    orig_hash = issued_cert["certificate_hash"]
    orig_sig = issued_cert["digital_signature"]
    print(f"Issued successfully:")
    print(f"  certificate_hash:  {orig_hash}")
    print(f"  digital_signature: {orig_sig}")

    print("\n=== Step 4: Verify Untampered Certificate (Baseline) ===")
    status, v_orig = http_req("/verify", method="POST", data={"reference": cert_no, "method": "MANUAL"})
    print(f"HTTP Status: {status}")
    print(json.dumps(v_orig, indent=2))
    assert v_orig["result"] == "VALID", f"Expected VALID, got {v_orig['result']}"
    assert v_orig["hash_valid"] is True
    assert v_orig["signature_valid"] is True
    print(">>> Baseline untampered certificate test: PASS (VALID)")

    print("\n=== Step 5: Test Case 1 & 4 — Stored Data Modified (Title altered) ===")
    run_sql(f"UPDATE dcvs.certificate SET title = 'Forged Doctor of Science' WHERE certificate_id = {cert_id};")
    status, v_case1 = http_req("/verify", method="POST", data={"reference": cert_no, "method": "MANUAL"})
    print(f"HTTP Status: {status}")
    print(json.dumps(v_case1, indent=2))
    assert v_case1["result"] == "TAMPERED", f"Expected TAMPERED, got {v_case1['result']}"
    assert v_case1["hash_valid"] is False, "Expected hash_valid to be False"
    assert v_case1["signature_valid"] is False, "Expected signature_valid to be False"
    assert v_case1["certificate"] is None, "Expected certificate payload to be None for security"
    print(">>> Test Case 1 & 4 (Data modified => Hash and signature mismatch): PASS (TAMPERED)")

    print("\n=== Step 6: Test Case 2 — Signature Mismatch (Hash recalculated, but signature forged/unmatched) ===")
    # Update certificate_hash to match the new forged title, but keep or alter digital signature
    run_sql(f"""
    DECLARE
      l_h VARCHAR2(64);
    BEGIN
      l_h := dcvs.pkg_certificate.compute_hash({cert_id});
      UPDATE dcvs.certificate SET certificate_hash = l_h WHERE certificate_id = {cert_id};
    END;
    /
    """)
    status, v_case2 = http_req("/verify", method="POST", data={"reference": cert_no, "method": "MANUAL"})
    print(f"HTTP Status: {status}")
    print(json.dumps(v_case2, indent=2))
    assert v_case2["result"] == "TAMPERED", f"Expected TAMPERED, got {v_case2['result']}"
    assert v_case2["hash_valid"] is True, "Expected hash_valid to be True"
    assert v_case2["signature_valid"] is False, "Expected signature_valid to be False (Signature mismatch detected!)"
    print(">>> Test Case 2 (Hash updated but Signature not valid): PASS (TAMPERED)")

    print("\n=== Step 7: Test Case 3 — Missing or Corrupted Signature ===")
    run_sql(f"UPDATE dcvs.certificate SET digital_signature = '0000000000000000000000000000000000000000000000000000000000000000' WHERE certificate_id = {cert_id};")
    status, v_case3 = http_req("/verify", method="POST", data={"reference": cert_no, "method": "MANUAL"})
    print(f"HTTP Status: {status}")
    print(json.dumps(v_case3, indent=2))
    assert v_case3["result"] == "TAMPERED", f"Expected TAMPERED, got {v_case3['result']}"
    assert v_case3["signature_valid"] is False, "Expected signature_valid to be False"
    print(">>> Test Case 3 (Corrupted signature detected): PASS (TAMPERED)")

    print(f"\nCompleted Cryptographic Integrity Suite for isolated test certificate {cert_no} (ID {cert_id}).")

if __name__ == "__main__":
    main()
