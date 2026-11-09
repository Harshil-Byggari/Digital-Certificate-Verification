import urllib.request
import urllib.error
import json
import os
import sys

API_BASE = os.environ.get("DCVS_API_BASE", "http://localhost:8080/ords/dcvs/api").rstrip("/")

def http_req(endpoint, method="GET", data=None, token=None, raw_body=None):
    url = f"{API_BASE}{endpoint}"
    headers = {"Accept": "application/json"}
    body = None
    if raw_body is not None:
        headers["Content-Type"] = "application/json"
        body = raw_body.encode("utf-8") if isinstance(raw_body, str) else raw_body
    elif data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    if token:
        headers["X-Auth-Token"] = token
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}, resp.headers
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body), e.headers
        except:
            return e.code, {"raw_error": err_body}, e.headers
    except Exception as ex:
        return 0, {"exception": str(ex)}, {}

def main():
    print("=" * 70)
    print("DCVS — Stage M6 Comprehensive Security Hardening & Vulnerability Suite")
    print(f"API Target: {API_BASE}")
    print("=" * 70)

    pass_count = 0
    fail_count = 0

    def check(test_name, condition, details=""):
        nonlocal pass_count, fail_count
        if condition:
            pass_count += 1
            print(f"  [PASS] {test_name}")
        else:
            fail_count += 1
            print(f"  [FAIL] {test_name} - {details}")

    # =========================================================================
    # SECTION 1: AUTHENTICATION HARDENING
    # =========================================================================
    print("\n--- 1. Authentication Hardening ---")

    # 1.1 Invalid credentials rejected
    status, res, _ = http_req("/auth/login", method="POST", data={"username": "admin", "password": "WrongPassword999!"})
    check("1.1 Invalid password returns 401", status == 401 or (status == 200 and not res.get("token")), f"status={status}, res={res}")

    # 1.2 Non-existent user rejected
    status, res, _ = http_req("/auth/login", method="POST", data={"username": "nonexistent_hacker_999", "password": "SomePassword123"})
    check("1.2 Non-existent user returns 401", status == 401 or (status == 200 and not res.get("token")), f"status={status}, res={res}")

    # 1.3 Empty payload rejected
    status, res, _ = http_req("/auth/login", method="POST", data={})
    check("1.3 Empty credentials payload rejected (400 or 401)", status in (400, 401), f"status={status}")

    # 1.4 Valid admin login succeeds
    admin_user = os.environ.get("DCVS_ADMIN_USER", "admin")
    admin_pass = os.environ.get("DCVS_ADMIN_PASS", "Admin@1234")
    status, res, _ = http_req("/auth/login", method="POST", data={"username": admin_user, "password": admin_pass})
    admin_data = res.get("data", res)
    admin_token = admin_data.get("token")
    check("1.4 Admin login succeeds and returns token", status == 200 and bool(admin_token), f"status={status}")

    # 1.5 Sensitive data absent from login response (no password_hash, no salt)
    user_obj = admin_data.get("user", {})
    check("1.5 Login response excludes password_hash and salt", "password_hash" not in user_obj and "salt" not in user_obj and "password" not in user_obj)

    # 1.6 /auth/me returns identity without credentials
    status, me_res, _ = http_req("/auth/me", method="GET", token=admin_token)
    me_data = me_res.get("data", me_res)
    check("1.6 GET /auth/me returns correct identity", status == 200 and me_data.get("username") == admin_user)
    check("1.6b GET /auth/me excludes password hashes", "password_hash" not in me_data and "salt" not in me_data)

    # 1.7 Access protected endpoint without token rejected (401)
    status, _, _ = http_req("/dashboard/stats", method="GET")
    check("1.7 Unauthenticated access to /dashboard/stats returns 401", status == 401, f"status={status}")

    status, _, _ = http_req("/certificates", method="GET")
    check("1.7b Unauthenticated access to /certificates returns 401", status == 401, f"status={status}")

    # 1.8 Forged / garbage token rejected (401)
    status, _, _ = http_req("/dashboard/stats", method="GET", token="forged-token-xyz-12345-hacker")
    check("1.8 Forged token returns 401", status == 401, f"status={status}")

    # 1.9 Logout invalidation
    status, v_res, _ = http_req("/auth/login", method="POST", data={"username": "verifier1", "password": "Verifier@123"})
    v_data = v_res.get("data", v_res)
    if status == 200 and v_data.get("token"):
        temp_token = v_data.get("token")
        # Ensure session works
        st_before, _, _ = http_req("/auth/me", method="GET", token=temp_token)
        # Logout
        st_logout, _, _ = http_req("/auth/logout", method="POST", token=temp_token)
        # Verify subsequent request is 401
        st_after, _, _ = http_req("/auth/me", method="GET", token=temp_token)
        check("1.9 POST /auth/logout immediately invalidates token (subsequent request returns 401)",
              st_before == 200 and st_logout == 200 and st_after == 401,
              f"st_before={st_before}, st_logout={st_logout}, st_after={st_after}")
    else:
        check("1.9 Disposable login for logout test", False, f"status={status}")

    # =========================================================================
    # SECTION 2: AUTHORIZATION & ROLE-BASED ACCESS CONTROL (RBAC)
    # =========================================================================
    print("\n--- 2. RBAC & Cross-Role Privilege Escalation Prevention ---")

    # Log in as APPLICANT (asha, linked_id = 1)
    status, app_res, _ = http_req("/auth/login", method="POST", data={"username": "asha", "password": "Applicant@123"})
    asha_data = app_res.get("data", app_res)
    asha_token = asha_data.get("token")
    check("2.0 Applicant Asha login succeeds", status == 200 and bool(asha_token))

    # Log in as VERIFIER (verifier1, linked_id = 2)
    status, vrf_res, _ = http_req("/auth/login", method="POST", data={"username": "verifier1", "password": "Verifier@123"})
    vrf_data = vrf_res.get("data", vrf_res)
    vrf_token = vrf_data.get("token")
    check("2.0b Verifier login succeeds", status == 200 and bool(vrf_token))

    # 2.1 Applicant cannot access Admin Dashboard
    st, _, _ = http_req("/dashboard/stats", method="GET", token=asha_token)
    check("2.1 Applicant blocked from GET /dashboard/stats (403)", st == 403, f"status={st}")

    # 2.2 Applicant cannot access full applicant list
    st, _, _ = http_req("/applicants", method="GET", token=asha_token)
    check("2.2 Applicant blocked from GET /applicants list (403)", st == 403, f"status={st}")

    # 2.3 Applicant cannot access issuers list
    st, _, _ = http_req("/issuers", method="GET", token=asha_token)
    check("2.3 Applicant blocked from GET /issuers (403)", st == 403, f"status={st}")

    # 2.4 Applicant cannot access HR records
    st, _, _ = http_req("/hr", method="GET", token=asha_token)
    check("2.4 Applicant blocked from GET /hr (403)", st == 403, f"status={st}")

    # 2.5 Applicant cannot access revocations list
    st, _, _ = http_req("/revocations", method="GET", token=asha_token)
    check("2.5 Applicant blocked from GET /revocations (403)", st == 403, f"status={st}")

    # 2.6 Applicant cannot create certificate
    st, _, _ = http_req("/certificates", method="POST", data={"title": "Hacked Degree"}, token=asha_token)
    check("2.6 Applicant blocked from POST /certificates (403)", st == 403, f"status={st}")

    # 2.7 Applicant cannot revoke certificate
    st, _, _ = http_req("/certificates/1/revoke", method="POST", data={"reason": "Malicious revocation"}, token=asha_token)
    check("2.7 Applicant blocked from POST /certificates/:id/revoke (403)", st == 403, f"status={st}")

    # 2.8 Verifier cannot access Admin Dashboard
    st, _, _ = http_req("/dashboard/stats", method="GET", token=vrf_token)
    check("2.8 Verifier blocked from GET /dashboard/stats (403)", st == 403, f"status={st}")

    # 2.9 Verifier cannot access Issuers
    st, _, _ = http_req("/issuers", method="GET", token=vrf_token)
    check("2.9 Verifier blocked from GET /issuers (403)", st == 403, f"status={st}")

    # 2.10 Verifier cannot access Revocations list
    st, _, _ = http_req("/revocations", method="GET", token=vrf_token)
    check("2.10 Verifier blocked from GET /revocations (403)", st == 403, f"status={st}")

    # 2.11 Verifier cannot revoke certificate
    st, _, _ = http_req("/certificates/1/revoke", method="POST", data={"reason": "Unauthorized"}, token=vrf_token)
    check("2.11 Verifier blocked from POST /certificates/:id/revoke (403)", st == 403, f"status={st}")

    # 2.12 Verifier cannot create certificate
    st, _, _ = http_req("/certificates", method="POST", data={"title": "Hacked"}, token=vrf_token)
    check("2.12 Verifier blocked from POST /certificates (403)", st == 403, f"status={st}")

    # =========================================================================
    # SECTION 3: OBJECT-LEVEL AUTHORIZATION & DATA ISOLATION
    # =========================================================================
    print("\n--- 3. Object-Level Access Control (Applicant Isolation) ---")

    # 3.1 Asha accessing own profile succeeds
    st, res, _ = http_req("/applicants/1", method="GET", token=asha_token)
    check("3.1 Asha can access own profile /applicants/1", st == 200 and res.get("data", {}).get("first_name") == "Asha", f"status={st}")

    # 3.2 Asha accessing Kiran's profile rejected
    st, res, _ = http_req("/applicants/2", method="GET", token=asha_token)
    check("3.2 Asha blocked from accessing Kiran profile /applicants/2", st in (400, 403, 404), f"status={st}, res={res}")

    # 3.3 Asha modifying Kiran's profile rejected
    st, res, _ = http_req("/applicants/2", method="PUT", data={"first_name": "Attacker"}, token=asha_token)
    check("3.3 Asha blocked from modifying Kiran profile /applicants/2", st in (400, 403, 404), f"status={st}")

    # 3.4 Asha listing certificates returns only Asha's certificates
    st, res, _ = http_req("/certificates", method="GET", token=asha_token)
    cert_list = res.get("data", [])
    all_owned = all(c.get("applicant_id") == 1 for c in cert_list)
    kiran_cert_present = any(c.get("certificate_id") == 3 for c in cert_list)
    draft_cert_present = any(c.get("certificate_id") == 4 for c in cert_list)
    check("3.4 Asha cert list contains only owned issued certs (Kiran's cert 3 excluded, Draft cert 4 excluded)",
          st == 200 and all_owned and not kiran_cert_present and not draft_cert_present,
          f"count={len(cert_list)}, kiran_cert_present={kiran_cert_present}, draft_present={draft_cert_present}")

    # 3.5 Asha accessing Kiran's certificate directly returns 404
    st, _, _ = http_req("/certificates/3", method="GET", token=asha_token)
    check("3.5 Asha accessing Kiran certificate /certificates/3 returns 404", st == 404, f"status={st}")

    # 3.6 Asha accessing unissued draft certificate 4 returns 404
    st, _, _ = http_req("/certificates/4", method="GET", token=asha_token)
    check("3.6 Asha accessing unissued certificate /certificates/4 returns 404", st == 404, f"status={st}")

    # 3.7 Asha retrieving QR for Kiran's certificate returns 404
    st, _, _ = http_req("/certificates/3/qr", method="GET", token=asha_token)
    check("3.7 Asha retrieving QR for Kiran's certificate /certificates/3/qr returns 404", st == 404, f"status={st}")

    # =========================================================================
    # SECTION 4: SQL INJECTION & INPUT VALIDATION
    # =========================================================================
    print("\n--- 4. SQL Injection & Input Validation ---")

    # 4.1 SQLi in /verify endpoint
    sqli_payloads = [
        "' OR '1'='1",
        "'; DROP TABLE certificate; --",
        "DCVS-2026-001' UNION SELECT 1,2,3,4,5,6,7,8,9,10 FROM dual--",
        "\" or \"\"=\"",
        "<script>alert(1)</script>",
    ]
    all_sqli_safe = True
    for p in sqli_payloads:
        st, res, _ = http_req("/verify", method="POST", data={"reference": p, "method": "MANUAL"})
        # Should return HTTP 200 with result='INVALID' or HTTP 400, never HTTP 500 / ORA error
        if st not in (200, 400) or res.get("result") not in ("INVALID", None):
            all_sqli_safe = False
            print(f"    Suspicious SQLi response for {p}: status={st}, res={res}")
    check("4.1 SQL injection payloads in /verify handled safely without SQL execution", all_sqli_safe)

    # 4.2 Malformed JSON in request body
    st, res, _ = http_req("/verify", method="POST", raw_body="This is not JSON at all!")
    check("4.2 Malformed JSON returns HTTP 400 without crashing", st == 400, f"status={st}")

    st, res, _ = http_req("/auth/login", method="POST", raw_body="{invalid_json:")
    check("4.2b Malformed JSON in /auth/login returns HTTP 400", st == 400, f"status={st}")

    # 4.3 Extremely long input (10,000 characters)
    huge_ref = "A" * 10000
    st, res, _ = http_req("/verify", method="POST", data={"reference": huge_ref, "method": "MANUAL"})
    check("4.3 Extremely long input handled gracefully (no server crash)", st in (200, 400), f"status={st}")

    # 4.4 Non-numeric ID in path parameter
    st, res, _ = http_req("/applicants/not-a-number", method="GET", token=admin_token)
    check("4.4 Non-numeric path parameter handled safely (400 or 404)", st in (400, 404), f"status={st}")

    # 4.5 Negative ID in path parameter
    st, res, _ = http_req("/applicants/-99", method="GET", token=admin_token)
    check("4.5 Negative path parameter safely rejected (403 or 404)", st in (400, 403, 404), f"status={st}")

    # =========================================================================
    # SECTION 5: INFORMATION DISCLOSURE & PII PROTECTION
    # =========================================================================
    print("\n--- 5. Information Disclosure & PII Protection ---")

    # 5.1 Public verification of valid certificate DCVS-2026-001
    st, pub_res, _ = http_req("/verify", method="POST", data={"reference": "DCVS-2026-001", "method": "MANUAL"})
    cert_data = pub_res.get("certificate", {})
    check("5.1 Public verification succeeds for DCVS-2026-001", st == 200 and pub_res.get("result") == "VALID")
    check("5.1b Public verification does NOT expose Aadhaar card", "aadhar_card" not in cert_data and "aadhar" not in cert_data)
    check("5.1c Public verification does NOT expose emails or phones", "emails" not in cert_data and "phones" not in cert_data and "email" not in cert_data)
    check("5.1d Public verification does NOT expose address / street", "street" not in cert_data and "pincode" not in cert_data)
    check("5.1e Public verification does NOT expose internal account IDs", "account_id" not in cert_data and "password_hash" not in cert_data)

    # 5.2 Public verification of invalid certificate does NOT leak internal data
    st, inv_res, _ = http_req("/verify", method="POST", data={"reference": "DOES-NOT-EXIST-000", "method": "MANUAL"})
    check("5.2 Invalid verification sets certificate to null", st == 200 and inv_res.get("result") == "INVALID" and inv_res.get("certificate") is None)

    # 5.3 Database error masking: check error response format
    st, err_res, _ = http_req("/types/999999", method="DELETE", token=admin_token)
    err_msg = err_res.get("error", "")
    check("5.3 Database errors are sanitized (no unhandled PL/SQL stack traces)",
          "ORA-06512" not in str(err_res) and "Package Body" not in str(err_res),
          f"err={err_res}")

    print("\n" + "=" * 70)
    print(f"M6 Security Suite Summary: {pass_count} PASSED, {fail_count} FAILED")
    print("=" * 70)

    return 0 if fail_count == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
