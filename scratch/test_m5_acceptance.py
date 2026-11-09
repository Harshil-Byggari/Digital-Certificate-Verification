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
set linesize 200 pagesize 100;
{sql_cmd}
exit;
EOF"""
    res = subprocess.run(["podman", "exec", "oracle-db", "bash", "-c", full_cmd],
                         capture_output=True, text=True)
    return res.stdout

def main():
    print("================================================================")
    print("DCVS — Stage M5 Final Acceptance & Data Isolation Verification")
    print("================================================================")

    # -------------------------------------------------------------
    # Step 1: Login as Applicant A (asha, ID 1) and Applicant B (kiran, ID 2)
    # -------------------------------------------------------------
    print("\n--- [Step 1] Logging in as Applicant A (asha) & Applicant B (kiran) ---")
    st_a, res_a = http_req("/auth/login", method="POST", data={"username": "asha", "password": "Applicant@123"})
    assert st_a == 200, f"Asha login failed: {res_a}"
    token_a = res_a["data"]["token"]
    user_a = res_a["data"]["user"]
    print(f"Applicant A logged in: username={user_a['username']}, linked_id={user_a['linked_id']}")

    st_b, res_b = http_req("/auth/login", method="POST", data={"username": "kiran", "password": "Applicant@123"})
    assert st_b == 200, f"Kiran login failed: {res_b}"
    token_b = res_b["data"]["token"]
    user_b = res_b["data"]["user"]
    print(f"Applicant B logged in: username={user_b['username']}, linked_id={user_b['linked_id']}")

    # -------------------------------------------------------------
    # Task 1: Applicant Data Isolation
    # -------------------------------------------------------------
    print("\n--- [Task 1] Testing Data Isolation for Applicant A ---")
    # 1.1 GET /certificates for Applicant A
    st, certs_a = http_req("/certificates", method="GET", token=token_a)
    print(f"GET /certificates (Applicant A) -> HTTP {st}, Count = {len(certs_a.get('data', []))}")
    cert_ids_a = [c["certificate_id"] for c in certs_a["data"]]
    print(f"Certificate IDs returned: {cert_ids_a}")
    assert 3 not in cert_ids_a, "Applicant A must NOT see Certificate 3 (belongs to Kiran)!"
    assert 1 in cert_ids_a, "Applicant A must see Certificate 1"

    # 1.2 GET /applicants/:id for Applicant A
    st, prof_a = http_req("/applicants/1", method="GET", token=token_a)
    print(f"GET /applicants/1 (Applicant A self) -> HTTP {st}")
    print(f"Profile: {prof_a['data']['full_name']}, Aadhaar: {prof_a['data']['aadhar_card']}")
    assert st == 200 and prof_a["data"]["applicant_id"] == 1

    # 1.3 Attempt to access Certificate 3 (belongs to Kiran) with Token A
    st, access_c3 = http_req("/certificates/3", method="GET", token=token_a)
    print(f"GET /certificates/3 (Applicant A attempting to access B's cert) -> HTTP {st}")
    print(f"Response: {access_c3}")
    assert st in (403, 404), f"Expected 403/404, got {st}"

    # 1.4 Attempt to access Applicant B's profile (/applicants/2) with Token A
    st, access_p2 = http_req("/applicants/2", method="GET", token=token_a)
    print(f"GET /applicants/2 (Applicant A attempting to access B's profile) -> HTTP {st}")
    print(f"Response: {access_p2}")
    assert st == 403, f"Expected 403 Forbidden, got {st}"

    # 1.5 Attempt to modify Applicant B's profile (/applicants/2) with Token A
    st, mod_p2 = http_req("/applicants/2", method="PUT", data={"city": "Hacked City"}, token=token_a)
    print(f"PUT /applicants/2 (Applicant A attempting to modify B's profile) -> HTTP {st}")
    print(f"Response: {mod_p2}")
    assert st == 403, f"Expected 403 Forbidden, got {st}"

    print("\n--- [Task 1] Testing Data Isolation for Applicant B (Reverse Check) ---")
    # 1.6 GET /certificates for Applicant B
    st, certs_b = http_req("/certificates", method="GET", token=token_b)
    print(f"GET /certificates (Applicant B) -> HTTP {st}, Count = {len(certs_b.get('data', []))}")
    cert_ids_b = [c["certificate_id"] for c in certs_b["data"]]
    print(f"Certificate IDs returned: {cert_ids_b}")
    assert 1 not in cert_ids_b, "Applicant B must NOT see Certificate 1 (belongs to Asha)!"
    assert 3 in cert_ids_b, "Applicant B must see Certificate 3"

    # 1.7 Attempt to access Certificate 1 with Token B
    st, access_c1 = http_req("/certificates/1", method="GET", token=token_b)
    print(f"GET /certificates/1 (Applicant B attempting to access A's cert) -> HTTP {st}")
    print(f"Response: {access_c1}")
    assert st in (403, 404), f"Expected 403/404, got {st}"

    # 1.8 Attempt to access Applicant A's profile (/applicants/1) with Token B
    st, access_p1 = http_req("/applicants/1", method="GET", token=token_b)
    print(f"GET /applicants/1 (Applicant B attempting to access A's profile) -> HTTP {st}")
    print(f"Response: {access_p1}")
    assert st == 403, f"Expected 403 Forbidden, got {st}"

    # 1.9 Attempt to modify Applicant A's profile (/applicants/1) with Token B
    st, mod_p1 = http_req("/applicants/1", method="PUT", data={"city": "Hacked City"}, token=token_b)
    print(f"PUT /applicants/1 (Applicant B attempting to modify A's profile) -> HTTP {st}")
    print(f"Response: {mod_p1}")
    assert st == 403, f"Expected 403 Forbidden, got {st}"

    print(">>> [PASS] Task 1: Complete Bidirectional Applicant Data Isolation Verified!")

    # -------------------------------------------------------------
    # Task 2: Profile Authorization & Field Integrity
    # -------------------------------------------------------------
    print("\n--- [Task 2] Testing Profile Authorization & Field Integrity ---")
    # Baseline check for Applicant 1
    orig_street = "12 Lake View"
    orig_aadhar = "999900000002"
    orig_dob = "2003-05-14"

    # Test update permitted fields (street, contacts)
    update_payload = {
        "first_name": "Asha",
        "middle_name": "M",
        "last_name": "Nair",
        "street": "12 Lake View Residency",
        "city": "Kollam",
        "state": "Kerala",
        "pincode": "690525",
        "emails": ["asha@example.com", "asha.work@example.com"],
        "phones": ["9000000020", "9000000021"]
    }
    st, update_res = http_req("/applicants/1", method="PUT", data=update_payload, token=token_a)
    print(f"PUT /applicants/1 (Authorized update by self) -> HTTP {st}")
    print(f"Updated Data: street='{update_res['data']['street']}', emails={update_res['data']['emails']}, aadhar='{update_res['data']['aadhar_card']}'")
    assert st == 200
    assert update_res["data"]["street"] == "12 Lake View Residency"
    assert update_res["data"]["aadhar_card"] == orig_aadhar, "Protected Aadhaar must remain unchanged!"
    assert len(update_res["data"]["emails"]) == 2, "Multivalued emails must persist both entries!"

    # Restore baseline street address so seed data is preserved cleanly
    restore_payload = {
        "first_name": "Asha",
        "middle_name": "M",
        "last_name": "Nair",
        "street": orig_street,
        "city": "Kollam",
        "state": "Kerala",
        "pincode": "690525",
        "emails": ["asha@example.com"],
        "phones": ["9000000020", "9000000021"]
    }
    st_r, res_r = http_req("/applicants/1", method="PUT", data=restore_payload, token=token_a)
    assert st_r == 200
    print(f"Restored seed baseline street to '{res_r['data']['street']}'.")
    print(">>> [PASS] Task 2: Profile Authorization & Field Integrity Verified!")

    # -------------------------------------------------------------
    # Task 3: Applicant Certificate Access & Administrative Action Denial
    # -------------------------------------------------------------
    print("\n--- [Task 3] Testing Certificate Access & Administrative Action Restrictions ---")
    # 3.1 QR retrieval enforces ownership
    st_qr_a, qr_res_a = http_req("/certificates/1/qr", method="GET", token=token_a)
    print(f"GET /certificates/1/qr (Applicant A for owned cert 1) -> HTTP {st_qr_a}")
    print(f"QR Response: {qr_res_a}")
    assert st_qr_a == 200 and "verify_url" in qr_res_a["data"]

    st_qr_unowned, qr_res_unowned = http_req("/certificates/3/qr", method="GET", token=token_a)
    print(f"GET /certificates/3/qr (Applicant A for unowned cert 3) -> HTTP {st_qr_unowned}")
    print(f"QR Response: {qr_res_unowned}")
    assert st_qr_unowned in (403, 404), f"Expected 403/404, got {st_qr_unowned}"

    # 3.2 Attempting Administrative Issue as Applicant
    st_iss, iss_res = http_req("/certificates/4/issue", method="POST", token=token_a)
    print(f"POST /certificates/4/issue (Applicant attempting to issue) -> HTTP {st_iss}")
    print(f"Response: {iss_res}")
    assert st_iss == 403, f"Expected 403 Forbidden, got {st_iss}"

    # 3.3 Attempting Administrative Revocation as Applicant
    st_rev, rev_res = http_req("/certificates/1/revoke", method="POST", data={"reason": "Unauthorized applicant attempt"}, token=token_a)
    print(f"POST /certificates/1/revoke (Applicant attempting to revoke) -> HTTP {st_rev}")
    print(f"Response: {rev_res}")
    assert st_rev == 403, f"Expected 403 Forbidden, got {st_rev}"

    # 3.4 Attempting Certificate Creation as Applicant
    st_crt, crt_res = http_req("/certificates", method="POST", data={"title": "Forged Cert", "applicant_id": 1}, token=token_a)
    print(f"POST /certificates (Applicant attempting to create cert) -> HTTP {st_crt}")
    print(f"Response: {crt_res}")
    assert st_crt == 403, f"Expected 403 Forbidden, got {st_crt}"

    print(">>> [PASS] Task 3: Certificate Ownership Enforced & Administrative Operations Strictly Denied!")

    print("\n================================================================")
    print("ALL M5 ACCEPTANCE VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("================================================================")

if __name__ == "__main__":
    main()
