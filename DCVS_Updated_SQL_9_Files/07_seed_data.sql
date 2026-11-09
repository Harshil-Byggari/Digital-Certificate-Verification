-- 07_seed_data.sql : synthetic demo data (fake Aadhaar numbers only!). Run AFTER 05 and 06.

DELETE FROM app_config WHERE cfg_key = 'VERIFY_BASE_URL';
INSERT INTO app_config(cfg_key, cfg_value) VALUES ('VERIFY_BASE_URL', 'http://localhost:5173/verify?ref=');

DECLARE
  l CLOB; o JSON_OBJECT_T;
  l_hr NUMBER; l_a1 NUMBER; l_a2 NUMBER; l_i1 NUMBER; l_i2 NUMBER;
  l_t1 NUMBER; l_t2 NUMBER; l_t3 NUMBER; l_c NUMBER;
BEGIN
  pkg_auth.create_account('admin', 'Admin@1234', 'ADMIN');

  l_t1 := JSON_OBJECT_T.parse(pkg_cert_type.create_json('{"type_name":"Degree Certificate","description":"University degree"}')).get_number('type_id');
  l_t2 := JSON_OBJECT_T.parse(pkg_cert_type.create_json('{"type_name":"Internship Certificate","description":"Internship completion"}')).get_number('type_id');
  l_t3 := JSON_OBJECT_T.parse(pkg_cert_type.create_json('{"type_name":"Course Certificate","description":"Short course completion"}')).get_number('type_id');

  l_i1 := JSON_OBJECT_T.parse(pkg_issuer.create_json(
    '{"issuer_name":"Example University","organisation":"Example University","email":"registrar@example.edu","phone":"9000000001","street":"1 College Road","city":"Kollam","state":"Kerala","pincode":"690525"}')).get_number('issuer_id');
  l_i2 := JSON_OBJECT_T.parse(pkg_issuer.create_json(
    '{"issuer_name":"Sample Tech Pvt Ltd","organisation":"Sample Tech","email":"hr@sampletech.example","phone":"9000000002","street":"22 Tech Park","city":"Bengaluru","state":"Karnataka","pincode":"560001"}')).get_number('issuer_id');

  l_hr := JSON_OBJECT_T.parse(pkg_hr.create_json(
    '{"hr_name":"Meera HR","basic":50000,"da":10000,"hra":15000,"leave_days":12,"username":"hr1","password":"Hr@12345"}')).get_number('hr_id');

  l := pkg_verifier.create_json(
    '{"first_name":"Ravi","last_name":"Kumar","aadhar_card":"999900000001","doj":"2024-06-01","role":"Verification Officer","organization":"Sample Tech Pvt Ltd","verifier_type":"Employer","city":"Bengaluru","state":"Karnataka","pincode":"560001","hr_id":'
    || l_hr || ',"emails":["ravi@sampletech.example"],"phones":["9000000010"],"username":"verifier1","password":"Verifier@123"}');

  l_a1 := JSON_OBJECT_T.parse(pkg_applicant.create_json(
    '{"first_name":"Asha","middle_name":"M","last_name":"Nair","dob":"2003-05-14","aadhar_card":"999900000002","street":"12 Lake View","city":"Kollam","state":"Kerala","pincode":"690525","emails":["asha@example.com"],"phones":["9000000020","9000000021"],"username":"asha","password":"Applicant@123"}')).get_number('applicant_id');
  l_a2 := JSON_OBJECT_T.parse(pkg_applicant.create_json(
    '{"first_name":"Kiran","last_name":"Reddy","dob":"2002-11-02","aadhar_card":"999900000003","city":"Hyderabad","state":"Telangana","pincode":"500001","emails":["kiran@example.com"],"phones":["9000000030"],"username":"kiran","password":"Applicant@123"}')).get_number('applicant_id');

  -- 1) VALID (no expiry)
  l_c := JSON_OBJECT_T.parse(pkg_certificate.create_json('{"title":"B.Tech Degree Certificate","applicant_id":'||l_a1||',"type_id":'||l_t1||',"issuer_id":'||l_i1||'}')).get_number('certificate_id');
  l := pkg_certificate.issue(l_c);
  -- 2) EXPIRED
  l_c := JSON_OBJECT_T.parse(pkg_certificate.create_json('{"title":"Summer Internship 2025","applicant_id":'||l_a1||',"type_id":'||l_t2||',"issuer_id":'||l_i2||',"issue_date":"2025-01-01","expiry_date":"2025-12-31"}')).get_number('certificate_id');
  l := pkg_certificate.issue(l_c);
  -- 3) REVOKED
  l_c := JSON_OBJECT_T.parse(pkg_certificate.create_json('{"title":"Embedded Systems Course","applicant_id":'||l_a2||',"type_id":'||l_t3||',"issuer_id":'||l_i1||'}')).get_number('certificate_id');
  l := pkg_certificate.issue(l_c);
  l := pkg_revocation.revoke_cert(l_c, 'Issued by mistake - wrong applicant', NULL);
  -- 4) DRAFT (created, not issued)
  l_c := JSON_OBJECT_T.parse(pkg_certificate.create_json('{"title":"Pending Course Certificate","applicant_id":'||l_a2||',"type_id":'||l_t3||',"issuer_id":'||l_i2||'}')).get_number('certificate_id');
  COMMIT;
END;
/
