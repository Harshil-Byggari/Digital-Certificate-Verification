-- 05_packages.sql : PL/SQL business logic. Run the WHOLE file in SQL Workshop > SQL Scripts.
-- Order: PKG_API, PKG_AUTH, PKG_APPLICANT, PKG_CERT_TYPE, PKG_ISSUER, PKG_HR, PKG_VERIFIER,
--        PKG_CERTIFICATE, PKG_REVOCATION, PKG_VERIFICATION, PKG_DASHBOARD

-------------------------------------------------------------------------------
-- PKG_API : helpers shared by every ORDS handler
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_api AS
  FUNCTION  sha256(p_text IN VARCHAR2) RETURN VARCHAR2;
  FUNCTION  ok(p_data IN CLOB) RETURN CLOB;
  PROCEDURE json_out(p_json IN CLOB);
  PROCEDURE error_out(p_message IN VARCHAR2);
  FUNCTION  status_for(p_sqlcode IN NUMBER) RETURN NUMBER;
  FUNCTION  clean_msg(p_msg IN VARCHAR2) RETURN VARCHAR2;
END pkg_api;
/
CREATE OR REPLACE PACKAGE BODY pkg_api AS
  FUNCTION sha256(p_text IN VARCHAR2) RETURN VARCHAR2 IS
    l VARCHAR2(64);
  BEGIN
    SELECT LOWER(RAWTOHEX(STANDARD_HASH(p_text, 'SHA256'))) INTO l FROM dual;
    RETURN l;
  END;

  FUNCTION ok(p_data IN CLOB) RETURN CLOB IS
  BEGIN
    RETURN '{"success":true,"data":' || NVL(p_data, TO_CLOB('null')) || '}';
  END;

  PROCEDURE json_out(p_json IN CLOB) IS
    l_pos PLS_INTEGER := 1;
    l_len PLS_INTEGER := NVL(DBMS_LOB.GETLENGTH(p_json), 0);
  BEGIN
    OWA_UTIL.MIME_HEADER('application/json', TRUE, 'UTF-8');
    WHILE l_pos <= l_len LOOP
      HTP.PRN(DBMS_LOB.SUBSTR(p_json, 4000, l_pos));
      l_pos := l_pos + 4000;
    END LOOP;
  END;

  PROCEDURE error_out(p_message IN VARCHAR2) IS
    l VARCHAR2(4000);
  BEGIN
    SELECT JSON_OBJECT('success' VALUE 'false' FORMAT JSON, 'error' VALUE SUBSTR(p_message,1,1000))
      INTO l FROM dual;
    json_out(TO_CLOB(l));
  END;

  FUNCTION status_for(p_sqlcode IN NUMBER) RETURN NUMBER IS
  BEGIN
    RETURN CASE
      WHEN p_sqlcode IN (-1, -2292)                     THEN 409   -- duplicate / referenced by other rows
      WHEN p_sqlcode IN (-20404, 100)                   THEN 404
      WHEN p_sqlcode BETWEEN -20999 AND -20000          THEN 400   -- our own validation errors
      WHEN p_sqlcode IN (-1400,-1407,-1438,-1722,-1840,-1843,-1847,-1858,-1861,-2290,-2291,-6502,-12899) THEN 400
      WHEN p_sqlcode BETWEEN -40500 AND -40400          THEN 400   -- malformed JSON
      ELSE 500 END;
  END;

  FUNCTION clean_msg(p_msg IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    RETURN REGEXP_REPLACE(SUBSTR(p_msg, 1, INSTR(p_msg || CHR(10), CHR(10)) - 1), '^ORA-[0-9]+: ', '');
  END;
END pkg_api;
/

-------------------------------------------------------------------------------
-- PKG_AUTH : accounts, login, sessions, role guard
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_auth AS
  g_account_id NUMBER;
  g_user_type  VARCHAR2(20);
  g_linked_id  NUMBER;
  FUNCTION  hash_password(p_password VARCHAR2, p_salt VARCHAR2 DEFAULT NULL) RETURN VARCHAR2;
  FUNCTION  check_password(p_password VARCHAR2, p_stored VARCHAR2) RETURN BOOLEAN;
  PROCEDURE create_account(p_username VARCHAR2, p_password VARCHAR2, p_user_type VARCHAR2, p_linked_id NUMBER DEFAULT NULL);
  FUNCTION  login(p_username VARCHAR2, p_password VARCHAR2) RETURN CLOB;   -- NULL = bad credentials
  PROCEDURE logout(p_token VARCHAR2);
  FUNCTION  guard(p_token VARCHAR2, p_roles VARCHAR2 DEFAULT NULL) RETURN NUMBER; -- 200 / 401 / 403
  FUNCTION  me_json RETURN CLOB;
  FUNCTION  is_self(p_type VARCHAR2, p_id NUMBER) RETURN BOOLEAN;
END pkg_auth;
/
CREATE OR REPLACE PACKAGE BODY pkg_auth AS
  FUNCTION hash_password(p_password VARCHAR2, p_salt VARCHAR2 DEFAULT NULL) RETURN VARCHAR2 IS
    l_salt VARCHAR2(64) := NVL(p_salt, LOWER(RAWTOHEX(SYS_GUID())));
  BEGIN
    RETURN l_salt || ':' || pkg_api.sha256(l_salt || p_password);
  END;

  FUNCTION check_password(p_password VARCHAR2, p_stored VARCHAR2) RETURN BOOLEAN IS
    l_salt VARCHAR2(64) := SUBSTR(p_stored, 1, INSTR(p_stored, ':') - 1);
  BEGIN
    RETURN hash_password(p_password, l_salt) = p_stored;
  END;

  PROCEDURE create_account(p_username VARCHAR2, p_password VARCHAR2, p_user_type VARCHAR2, p_linked_id NUMBER DEFAULT NULL) IS
  BEGIN
    IF p_username IS NULL OR LENGTH(TRIM(p_username)) < 3 THEN
      RAISE_APPLICATION_ERROR(-20021, 'Username must be at least 3 characters');
    END IF;
    IF p_password IS NULL OR LENGTH(p_password) < 8 THEN
      RAISE_APPLICATION_ERROR(-20020, 'Password must be at least 8 characters');
    END IF;
    INSERT INTO account(username, password_hash, user_type, applicant_id, verifier_id, hr_id)
    VALUES (LOWER(TRIM(p_username)), hash_password(p_password), p_user_type,
            CASE WHEN p_user_type = 'APPLICANT' THEN p_linked_id END,
            CASE WHEN p_user_type = 'VERIFIER'  THEN p_linked_id END,
            CASE WHEN p_user_type = 'HR'        THEN p_linked_id END);
  END;

  FUNCTION login(p_username VARCHAR2, p_password VARCHAR2) RETURN CLOB IS
    l_acc    account%ROWTYPE;
    l_token  VARCHAR2(64);
    o        JSON_OBJECT_T := JSON_OBJECT_T();
    u        JSON_OBJECT_T := JSON_OBJECT_T();
  BEGIN
    SELECT * INTO l_acc FROM account
     WHERE username = LOWER(TRIM(p_username)) AND status = 'ACTIVE';
    IF NOT check_password(p_password, l_acc.password_hash) THEN
      RETURN NULL;
    END IF;
    DELETE FROM auth_session WHERE expires_at < SYSTIMESTAMP;
    l_token := pkg_api.sha256(RAWTOHEX(SYS_GUID()) || TO_CHAR(SYSTIMESTAMP,'YYYYMMDDHH24MISSFF9')
                              || DBMS_RANDOM.STRING('x', 40) || l_acc.username);
    INSERT INTO auth_session(token_hash, account_id, expires_at)
    VALUES (pkg_api.sha256(l_token), l_acc.account_id, SYSTIMESTAMP + INTERVAL '2' HOUR);
    UPDATE account SET last_login = SYSTIMESTAMP WHERE account_id = l_acc.account_id;
    u.put('account_id', l_acc.account_id);
    u.put('username',   l_acc.username);
    u.put('user_type',  l_acc.user_type);
    u.put('linked_id',  COALESCE(l_acc.applicant_id, l_acc.verifier_id, l_acc.hr_id));
    o.put('token', l_token);
    o.put('expires_in', 7200);
    o.put('user', u);
    RETURN o.to_clob;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    RETURN NULL;
  END;

  PROCEDURE logout(p_token VARCHAR2) IS
  BEGIN
    DELETE FROM auth_session WHERE token_hash = pkg_api.sha256(p_token);
  END;

  FUNCTION guard(p_token VARCHAR2, p_roles VARCHAR2 DEFAULT NULL) RETURN NUMBER IS
    l_hash VARCHAR2(64);
  BEGIN
    g_account_id := NULL; g_user_type := NULL; g_linked_id := NULL;   -- pooled sessions: always reset
    IF p_token IS NULL THEN RETURN 401; END IF;
    l_hash := pkg_api.sha256(p_token);
    SELECT a.account_id, a.user_type, COALESCE(a.applicant_id, a.verifier_id, a.hr_id)
      INTO g_account_id, g_user_type, g_linked_id
      FROM auth_session s JOIN account a ON a.account_id = s.account_id
     WHERE s.token_hash = l_hash AND s.expires_at > SYSTIMESTAMP AND a.status = 'ACTIVE';
    IF p_roles IS NOT NULL AND INSTR(',' || p_roles || ',', ',' || g_user_type || ',') = 0 THEN
      RETURN 403;
    END IF;
    RETURN 200;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    g_account_id := NULL; g_user_type := NULL; g_linked_id := NULL;
    RETURN 401;
  END;

  FUNCTION me_json RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T();
    l_username VARCHAR2(100);
  BEGIN
    SELECT username INTO l_username FROM account WHERE account_id = g_account_id;
    o.put('account_id', g_account_id);
    o.put('username',   l_username);
    o.put('user_type',  g_user_type);
    o.put('linked_id',  g_linked_id);
    RETURN o.to_clob;
  END;

  FUNCTION is_self(p_type VARCHAR2, p_id NUMBER) RETURN BOOLEAN IS
  BEGIN
    RETURN g_user_type = p_type AND g_linked_id = p_id;
  END;
END pkg_auth;
/

-------------------------------------------------------------------------------
-- PKG_APPLICANT
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_applicant AS
  FUNCTION  get_json(p_id NUMBER) RETURN CLOB;
  FUNCTION  get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB;
  FUNCTION  list_json RETURN CLOB;
  FUNCTION  create_json(p_body CLOB) RETURN CLOB;
  FUNCTION  update_json(p_id NUMBER, p_body CLOB) RETURN CLOB;
  PROCEDURE delete_row(p_id NUMBER);
END pkg_applicant;
/
CREATE OR REPLACE PACKAGE BODY pkg_applicant AS
  PROCEDURE save_contacts(p_id NUMBER, o JSON_OBJECT_T) IS
    a JSON_ARRAY_T;
  BEGIN
    IF o.has('emails') THEN
      DELETE FROM applicant_email WHERE applicant_id = p_id;
      a := o.get_array('emails');
      IF a IS NOT NULL THEN
        FOR i IN 0 .. a.get_size - 1 LOOP
          INSERT INTO applicant_email(applicant_id, email) VALUES (p_id, TRIM(a.get_string(i)));
        END LOOP;
      END IF;
    END IF;
    IF o.has('phones') THEN
      DELETE FROM applicant_phone WHERE applicant_id = p_id;
      a := o.get_array('phones');
      IF a IS NOT NULL THEN
        FOR i IN 0 .. a.get_size - 1 LOOP
          INSERT INTO applicant_phone(applicant_id, phone) VALUES (p_id, TRIM(a.get_string(i)));
        END LOOP;
      END IF;
    END IF;
  END;

  FUNCTION get_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_OBJECT(
      'applicant_id' VALUE a.applicant_id,
      'first_name'   VALUE a.first_name,
      'middle_name'  VALUE a.middle_name,
      'last_name'    VALUE a.last_name,
      'full_name'    VALUE a.first_name || NVL2(a.middle_name, ' '||a.middle_name, '') || ' ' || a.last_name,
      'dob'          VALUE TO_CHAR(a.dob, 'YYYY-MM-DD'),
      'aadhar_card'  VALUE a.aadhar_card,
      'street'       VALUE a.street,
      'city'         VALUE a.city,
      'state'        VALUE a.state,
      'pincode'      VALUE a.pincode,
      'emails' VALUE NVL((SELECT JSON_ARRAYAGG(e.email ORDER BY e.email RETURNING CLOB)
                            FROM applicant_email e WHERE e.applicant_id = a.applicant_id), TO_CLOB('[]')) FORMAT JSON,
      'phones' VALUE NVL((SELECT JSON_ARRAYAGG(p.phone ORDER BY p.phone RETURNING CLOB)
                            FROM applicant_phone p WHERE p.applicant_id = a.applicant_id), TO_CLOB('[]')) FORMAT JSON
      RETURNING CLOB)
    INTO l FROM applicant a WHERE a.applicant_id = p_id;
    RETURN l;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB IS
  BEGIN
    IF p_type = 'APPLICANT' AND p_linked <> p_id THEN RETURN NULL; END IF;
    IF p_type NOT IN ('ADMIN','HR','VERIFIER','APPLICANT') THEN RETURN NULL; END IF;
    RETURN get_json(p_id);
  END;

  FUNCTION list_json RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(get_json(applicant_id) FORMAT JSON ORDER BY applicant_id RETURNING CLOB)
      INTO l FROM applicant;
    RETURN NVL(l, TO_CLOB('[]'));
  END;

  FUNCTION create_json(p_body CLOB) RETURN CLOB IS
    o  JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_fn VARCHAR2(50)  := o.get_string('first_name');
    l_mn VARCHAR2(50)  := o.get_string('middle_name');
    l_ln VARCHAR2(50)  := o.get_string('last_name');
    l_dob DATE         := TO_DATE(o.get_string('dob'), 'YYYY-MM-DD');
    l_aad VARCHAR2(12) := o.get_string('aadhar_card');
    l_st VARCHAR2(150) := o.get_string('street');
    l_ci VARCHAR2(80)  := o.get_string('city');
    l_sa VARCHAR2(80)  := o.get_string('state');
    l_pi VARCHAR2(6)   := o.get_string('pincode');
    l_user VARCHAR2(100) := o.get_string('username');
    l_id NUMBER;
  BEGIN
    INSERT INTO applicant(first_name, middle_name, last_name, dob, aadhar_card, street, city, state, pincode)
    VALUES (l_fn, l_mn, l_ln, l_dob, l_aad, l_st, l_ci, l_sa, l_pi)
    RETURNING applicant_id INTO l_id;
    save_contacts(l_id, o);
    IF l_user IS NOT NULL THEN
      pkg_auth.create_account(l_user, o.get_string('password'), 'APPLICANT', l_id);
    END IF;
    RETURN get_json(l_id);
  END;

  FUNCTION update_json(p_id NUMBER, p_body CLOB) RETURN CLOB IS
    o  JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_fn VARCHAR2(50)  := o.get_string('first_name');
    l_mn VARCHAR2(50)  := o.get_string('middle_name');
    l_ln VARCHAR2(50)  := o.get_string('last_name');
    l_dob DATE         := TO_DATE(o.get_string('dob'), 'YYYY-MM-DD');
    l_aad VARCHAR2(12) := o.get_string('aadhar_card');
    l_st VARCHAR2(150) := o.get_string('street');
    l_ci VARCHAR2(80)  := o.get_string('city');
    l_sa VARCHAR2(80)  := o.get_string('state');
    l_pi VARCHAR2(6)   := o.get_string('pincode');
  BEGIN
    UPDATE applicant SET
      first_name = NVL(l_fn, first_name), middle_name = NVL(l_mn, middle_name), last_name = NVL(l_ln, last_name),
      dob = NVL(l_dob, dob), aadhar_card = NVL(l_aad, aadhar_card), street = NVL(l_st, street),
      city = NVL(l_ci, city), state = NVL(l_sa, state), pincode = NVL(l_pi, pincode)
    WHERE applicant_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RETURN NULL; END IF;
    save_contacts(p_id, o);
    RETURN get_json(p_id);
  END;

  PROCEDURE delete_row(p_id NUMBER) IS
  BEGIN
    DELETE FROM applicant WHERE applicant_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'Applicant not found'); END IF;
  END;
END pkg_applicant;
/

-------------------------------------------------------------------------------
-- PKG_CERT_TYPE
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_cert_type AS
  FUNCTION  get_json(p_id NUMBER) RETURN CLOB;
  FUNCTION  list_json RETURN CLOB;
  FUNCTION  create_json(p_body CLOB) RETURN CLOB;
  FUNCTION  update_json(p_id NUMBER, p_body CLOB) RETURN CLOB;
  PROCEDURE delete_row(p_id NUMBER);
END pkg_cert_type;
/
CREATE OR REPLACE PACKAGE BODY pkg_cert_type AS
  FUNCTION get_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_OBJECT('type_id' VALUE type_id, 'type_name' VALUE type_name, 'description' VALUE description RETURNING CLOB)
      INTO l FROM certificate_type WHERE type_id = p_id;
    RETURN l;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION list_json RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(get_json(type_id) FORMAT JSON ORDER BY type_name RETURNING CLOB) INTO l FROM certificate_type;
    RETURN NVL(l, TO_CLOB('[]'));
  END;

  FUNCTION create_json(p_body CLOB) RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_name VARCHAR2(100) := o.get_string('type_name');
    l_desc VARCHAR2(500) := o.get_string('description');
    l_id NUMBER;
  BEGIN
    INSERT INTO certificate_type(type_name, description) VALUES (l_name, l_desc) RETURNING type_id INTO l_id;
    RETURN get_json(l_id);
  END;

  FUNCTION update_json(p_id NUMBER, p_body CLOB) RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_name VARCHAR2(100) := o.get_string('type_name');
    l_desc VARCHAR2(500) := o.get_string('description');
  BEGIN
    UPDATE certificate_type SET type_name = NVL(l_name, type_name), description = NVL(l_desc, description)
     WHERE type_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RETURN NULL; END IF;
    RETURN get_json(p_id);
  END;

  PROCEDURE delete_row(p_id NUMBER) IS
  BEGIN
    DELETE FROM certificate_type WHERE type_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'Certificate type not found'); END IF;
  END;
END pkg_cert_type;
/

-------------------------------------------------------------------------------
-- PKG_ISSUER  (generates the signing secret + public key fingerprint)
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_issuer AS
  FUNCTION  get_json(p_id NUMBER) RETURN CLOB;
  FUNCTION  list_json RETURN CLOB;
  FUNCTION  create_json(p_body CLOB) RETURN CLOB;
  FUNCTION  update_json(p_id NUMBER, p_body CLOB) RETURN CLOB;
  PROCEDURE delete_row(p_id NUMBER);
  FUNCTION  certificates_json(p_id NUMBER) RETURN CLOB;
END pkg_issuer;
/
CREATE OR REPLACE PACKAGE BODY pkg_issuer AS
  FUNCTION get_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_OBJECT('issuer_id' VALUE issuer_id, 'issuer_name' VALUE issuer_name, 'public_key' VALUE public_key,
                       'organisation' VALUE organisation, 'email' VALUE email, 'phone' VALUE phone,
                       'street' VALUE street, 'city' VALUE city, 'state' VALUE state, 'pincode' VALUE pincode
                       RETURNING CLOB)
      INTO l FROM issuer WHERE issuer_id = p_id;
    RETURN l;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION list_json RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(get_json(issuer_id) FORMAT JSON ORDER BY issuer_name RETURNING CLOB) INTO l FROM issuer;
    RETURN NVL(l, TO_CLOB('[]'));
  END;

  FUNCTION create_json(p_body CLOB) RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_name VARCHAR2(150) := o.get_string('issuer_name');
    l_org  VARCHAR2(200) := o.get_string('organisation');
    l_em   VARCHAR2(150) := o.get_string('email');
    l_ph   VARCHAR2(20)  := o.get_string('phone');
    l_st   VARCHAR2(150) := o.get_string('street');
    l_ci   VARCHAR2(80)  := o.get_string('city');
    l_sa   VARCHAR2(80)  := o.get_string('state');
    l_pi   VARCHAR2(6)   := o.get_string('pincode');
    l_id NUMBER;
    l_secret VARCHAR2(64);
  BEGIN
    INSERT INTO issuer(issuer_name, organisation, email, phone, street, city, state, pincode)
    VALUES (l_name, l_org, l_em, l_ph, l_st, l_ci, l_sa, l_pi) RETURNING issuer_id INTO l_id;
    l_secret := pkg_api.sha256(RAWTOHEX(SYS_GUID()) || DBMS_RANDOM.STRING('x', 40) || l_id);
    INSERT INTO issuer_secret(issuer_id, secret_key) VALUES (l_id, l_secret);
    UPDATE issuer SET public_key = 'DCVS-PUB-' || UPPER(SUBSTR(pkg_api.sha256(l_secret), 1, 40)) WHERE issuer_id = l_id;
    RETURN get_json(l_id);
  END;

  FUNCTION update_json(p_id NUMBER, p_body CLOB) RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_name VARCHAR2(150) := o.get_string('issuer_name');
    l_org  VARCHAR2(200) := o.get_string('organisation');
    l_em   VARCHAR2(150) := o.get_string('email');
    l_ph   VARCHAR2(20)  := o.get_string('phone');
    l_st   VARCHAR2(150) := o.get_string('street');
    l_ci   VARCHAR2(80)  := o.get_string('city');
    l_sa   VARCHAR2(80)  := o.get_string('state');
    l_pi   VARCHAR2(6)   := o.get_string('pincode');
  BEGIN
    UPDATE issuer SET issuer_name = NVL(l_name, issuer_name), organisation = NVL(l_org, organisation),
      email = NVL(l_em, email), phone = NVL(l_ph, phone), street = NVL(l_st, street),
      city = NVL(l_ci, city), state = NVL(l_sa, state), pincode = NVL(l_pi, pincode)
    WHERE issuer_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RETURN NULL; END IF;
    RETURN get_json(p_id);
  END;

  PROCEDURE delete_row(p_id NUMBER) IS
  BEGIN
    DELETE FROM issuer WHERE issuer_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'Issuer not found'); END IF;
  END;

  FUNCTION certificates_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(JSON_OBJECT('certificate_id' VALUE certificate_id, 'certificate_no' VALUE certificate_no,
             'title' VALUE title, 'applicant_name' VALUE applicant_name, 'status' VALUE status) ORDER BY certificate_id RETURNING CLOB)
      INTO l FROM v_certificate_detail WHERE issuer_id = p_id;
    RETURN NVL(l, TO_CLOB('[]'));
  END;
END pkg_issuer;
/

-------------------------------------------------------------------------------
-- PKG_VERIFIER  (declared before PKG_HR because HR lists its verifiers)
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_verifier AS
  FUNCTION  get_json(p_id NUMBER) RETURN CLOB;
  FUNCTION  get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB;
  FUNCTION  list_json(p_type VARCHAR2, p_linked NUMBER) RETURN CLOB;
  FUNCTION  create_json(p_body CLOB) RETURN CLOB;
  FUNCTION  update_json(p_id NUMBER, p_body CLOB, p_is_admin BOOLEAN) RETURN CLOB;
  PROCEDURE delete_row(p_id NUMBER);
END pkg_verifier;
/
CREATE OR REPLACE PACKAGE BODY pkg_verifier AS
  PROCEDURE save_contacts(p_id NUMBER, o JSON_OBJECT_T) IS
    a JSON_ARRAY_T;
  BEGIN
    IF o.has('emails') THEN
      DELETE FROM verifier_email WHERE verifier_id = p_id;
      a := o.get_array('emails');
      IF a IS NOT NULL THEN
        FOR i IN 0 .. a.get_size - 1 LOOP
          INSERT INTO verifier_email(verifier_id, email) VALUES (p_id, TRIM(a.get_string(i)));
        END LOOP;
      END IF;
    END IF;
    IF o.has('phones') THEN
      DELETE FROM verifier_phone WHERE verifier_id = p_id;
      a := o.get_array('phones');
      IF a IS NOT NULL THEN
        FOR i IN 0 .. a.get_size - 1 LOOP
          INSERT INTO verifier_phone(verifier_id, phone) VALUES (p_id, TRIM(a.get_string(i)));
        END LOOP;
      END IF;
    END IF;
  END;

  FUNCTION get_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_OBJECT(
      'verifier_id'   VALUE v.verifier_id,
      'first_name'    VALUE v.first_name,
      'middle_name'   VALUE v.middle_name,
      'last_name'     VALUE v.last_name,
      'full_name'     VALUE v.first_name || NVL2(v.middle_name, ' '||v.middle_name, '') || ' ' || v.last_name,
      'aadhar_card'   VALUE v.aadhar_card,
      'doj'           VALUE TO_CHAR(v.doj, 'YYYY-MM-DD'),
      'role'          VALUE v.verifier_role,
      'organization'  VALUE v.organization,
      'verifier_type' VALUE v.verifier_type,
      'street' VALUE v.street, 'city' VALUE v.city, 'state' VALUE v.state, 'pincode' VALUE v.pincode,
      'hr_id'         VALUE v.hr_id,
      'emails' VALUE NVL((SELECT JSON_ARRAYAGG(e.email ORDER BY e.email RETURNING CLOB)
                            FROM verifier_email e WHERE e.verifier_id = v.verifier_id), TO_CLOB('[]')) FORMAT JSON,
      'phones' VALUE NVL((SELECT JSON_ARRAYAGG(p.phone ORDER BY p.phone RETURNING CLOB)
                            FROM verifier_phone p WHERE p.verifier_id = v.verifier_id), TO_CLOB('[]')) FORMAT JSON
      RETURNING CLOB)
    INTO l FROM verifier v WHERE v.verifier_id = p_id;
    RETURN l;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB IS
    n NUMBER;
  BEGIN
    IF p_type = 'ADMIN' THEN RETURN get_json(p_id); END IF;
    IF p_type = 'VERIFIER' THEN
      IF p_linked = p_id THEN RETURN get_json(p_id); ELSE RETURN NULL; END IF;
    END IF;
    IF p_type = 'HR' THEN
      SELECT COUNT(*) INTO n FROM verifier WHERE verifier_id = p_id AND hr_id = p_linked;
      IF n = 1 THEN RETURN get_json(p_id); END IF;
    END IF;
    RETURN NULL;
  END;

  FUNCTION list_json(p_type VARCHAR2, p_linked NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(get_json(v.verifier_id) FORMAT JSON ORDER BY v.verifier_id RETURNING CLOB)
      INTO l FROM verifier v
     WHERE p_type = 'ADMIN' OR (p_type = 'HR' AND v.hr_id = p_linked);
    RETURN NVL(l, TO_CLOB('[]'));
  END;

  FUNCTION create_json(p_body CLOB) RETURN CLOB IS
    o  JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_fn  VARCHAR2(50)  := o.get_string('first_name');
    l_mn  VARCHAR2(50)  := o.get_string('middle_name');
    l_ln  VARCHAR2(50)  := o.get_string('last_name');
    l_aad VARCHAR2(12)  := o.get_string('aadhar_card');
    l_doj DATE          := TO_DATE(o.get_string('doj'), 'YYYY-MM-DD');
    l_rol VARCHAR2(80)  := o.get_string('role');
    l_org VARCHAR2(200) := o.get_string('organization');
    l_typ VARCHAR2(50)  := o.get_string('verifier_type');
    l_st  VARCHAR2(150) := o.get_string('street');
    l_ci  VARCHAR2(80)  := o.get_string('city');
    l_sa  VARCHAR2(80)  := o.get_string('state');
    l_pi  VARCHAR2(6)   := o.get_string('pincode');
    l_hr  NUMBER        := o.get_number('hr_id');
    l_user VARCHAR2(100) := o.get_string('username');
    l_id NUMBER;
  BEGIN
    INSERT INTO verifier(first_name, middle_name, last_name, aadhar_card, doj, verifier_role, organization,
                         verifier_type, street, city, state, pincode, hr_id)
    VALUES (l_fn, l_mn, l_ln, l_aad, l_doj, l_rol, l_org, l_typ, l_st, l_ci, l_sa, l_pi, l_hr)
    RETURNING verifier_id INTO l_id;
    save_contacts(l_id, o);
    IF l_user IS NOT NULL THEN
      pkg_auth.create_account(l_user, o.get_string('password'), 'VERIFIER', l_id);
    END IF;
    RETURN get_json(l_id);
  END;

  FUNCTION update_json(p_id NUMBER, p_body CLOB, p_is_admin BOOLEAN) RETURN CLOB IS
    o  JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_fn  VARCHAR2(50)  := o.get_string('first_name');
    l_mn  VARCHAR2(50)  := o.get_string('middle_name');
    l_ln  VARCHAR2(50)  := o.get_string('last_name');
    l_aad VARCHAR2(12)  := o.get_string('aadhar_card');
    l_doj DATE          := TO_DATE(o.get_string('doj'), 'YYYY-MM-DD');
    l_rol VARCHAR2(80)  := o.get_string('role');
    l_org VARCHAR2(200) := o.get_string('organization');
    l_typ VARCHAR2(50)  := o.get_string('verifier_type');
    l_st  VARCHAR2(150) := o.get_string('street');
    l_ci  VARCHAR2(80)  := o.get_string('city');
    l_sa  VARCHAR2(80)  := o.get_string('state');
    l_pi  VARCHAR2(6)   := o.get_string('pincode');
    l_hr  NUMBER        := CASE WHEN p_is_admin THEN o.get_number('hr_id') ELSE NULL END;  -- only admin may re-assign HR
  BEGIN
    UPDATE verifier SET first_name = NVL(l_fn, first_name), middle_name = NVL(l_mn, middle_name),
      last_name = NVL(l_ln, last_name), aadhar_card = NVL(l_aad, aadhar_card), doj = NVL(l_doj, doj),
      verifier_role = NVL(l_rol, verifier_role), organization = NVL(l_org, organization),
      verifier_type = NVL(l_typ, verifier_type), street = NVL(l_st, street), city = NVL(l_ci, city),
      state = NVL(l_sa, state), pincode = NVL(l_pi, pincode), hr_id = NVL(l_hr, hr_id)
    WHERE verifier_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RETURN NULL; END IF;
    save_contacts(p_id, o);
    RETURN get_json(p_id);
  END;

  PROCEDURE delete_row(p_id NUMBER) IS
  BEGIN
    DELETE FROM verifier WHERE verifier_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'Verifier not found'); END IF;
  END;
END pkg_verifier;
/

-------------------------------------------------------------------------------
-- PKG_HR
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_hr AS
  FUNCTION  get_json(p_id NUMBER) RETURN CLOB;
  FUNCTION  get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB;
  FUNCTION  list_json RETURN CLOB;
  FUNCTION  create_json(p_body CLOB) RETURN CLOB;
  FUNCTION  update_json(p_id NUMBER, p_body CLOB) RETURN CLOB;
  PROCEDURE delete_row(p_id NUMBER);
  FUNCTION  verifiers_json(p_id NUMBER) RETURN CLOB;
END pkg_hr;
/
CREATE OR REPLACE PACKAGE BODY pkg_hr AS
  FUNCTION get_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_OBJECT('hr_id' VALUE h.hr_id, 'hr_name' VALUE h.hr_name, 'basic' VALUE h.basic, 'da' VALUE h.da,
                       'hra' VALUE h.hra, 'salary' VALUE h.salary, 'leave_days' VALUE h.leave_days,
                       'verifier_count' VALUE (SELECT COUNT(*) FROM verifier v WHERE v.hr_id = h.hr_id)
                       RETURNING CLOB)
      INTO l FROM hr h WHERE h.hr_id = p_id;
    RETURN l;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB IS
  BEGIN
    IF p_type = 'ADMIN' OR (p_type = 'HR' AND p_linked = p_id) THEN RETURN get_json(p_id); END IF;
    RETURN NULL;
  END;

  FUNCTION list_json RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(get_json(hr_id) FORMAT JSON ORDER BY hr_id RETURNING CLOB) INTO l FROM hr;
    RETURN NVL(l, TO_CLOB('[]'));
  END;

  FUNCTION create_json(p_body CLOB) RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_name VARCHAR2(100) := o.get_string('hr_name');
    l_basic NUMBER := o.get_number('basic');
    l_da    NUMBER := NVL(o.get_number('da'), 0);
    l_hra   NUMBER := NVL(o.get_number('hra'), 0);
    l_leave NUMBER := NVL(o.get_number('leave_days'), 0);
    l_user  VARCHAR2(100) := o.get_string('username');
    l_id NUMBER;
  BEGIN
    INSERT INTO hr(hr_name, basic, da, hra, leave_days) VALUES (l_name, l_basic, l_da, l_hra, l_leave)
    RETURNING hr_id INTO l_id;
    IF l_user IS NOT NULL THEN
      pkg_auth.create_account(l_user, o.get_string('password'), 'HR', l_id);
    END IF;
    RETURN get_json(l_id);
  END;

  FUNCTION update_json(p_id NUMBER, p_body CLOB) RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_name VARCHAR2(100) := o.get_string('hr_name');
    l_basic NUMBER := o.get_number('basic');
    l_da    NUMBER := o.get_number('da');
    l_hra   NUMBER := o.get_number('hra');
    l_leave NUMBER := o.get_number('leave_days');
  BEGIN
    UPDATE hr SET hr_name = NVL(l_name, hr_name), basic = NVL(l_basic, basic), da = NVL(l_da, da),
                  hra = NVL(l_hra, hra), leave_days = NVL(l_leave, leave_days)
     WHERE hr_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RETURN NULL; END IF;
    RETURN get_json(p_id);
  END;

  PROCEDURE delete_row(p_id NUMBER) IS
  BEGIN
    DELETE FROM hr WHERE hr_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'HR record not found'); END IF;
  END;

  FUNCTION verifiers_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(pkg_verifier.get_json(verifier_id) FORMAT JSON ORDER BY verifier_id RETURNING CLOB)
      INTO l FROM verifier WHERE hr_id = p_id;
    RETURN NVL(l, TO_CLOB('[]'));
  END;
END pkg_hr;
/

-------------------------------------------------------------------------------
-- PKG_CERTIFICATE : create / issue (hash + signature + QR URL) / read
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_certificate AS
  FUNCTION  compute_hash(p_id NUMBER) RETURN VARCHAR2;
  FUNCTION  compute_signature(p_hash VARCHAR2, p_issuer_id NUMBER) RETURN VARCHAR2;
  FUNCTION  get_json(p_id NUMBER) RETURN CLOB;
  FUNCTION  get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB;
  FUNCTION  list_json(p_type VARCHAR2, p_linked NUMBER) RETURN CLOB;
  FUNCTION  create_json(p_body CLOB) RETURN CLOB;
  FUNCTION  update_json(p_id NUMBER, p_body CLOB) RETURN CLOB;
  PROCEDURE delete_row(p_id NUMBER);
  FUNCTION  issue(p_id NUMBER) RETURN CLOB;
  FUNCTION  qr_json(p_id NUMBER) RETURN CLOB;
  FUNCTION  check_json(p_id NUMBER) RETURN CLOB;   -- hash + signature re-check (admin screen)
END pkg_certificate;
/
CREATE OR REPLACE PACKAGE BODY pkg_certificate AS
  FUNCTION compute_hash(p_id NUMBER) RETURN VARCHAR2 IS
    c certificate%ROWTYPE;
  BEGIN
    SELECT * INTO c FROM certificate WHERE certificate_id = p_id;
    RETURN pkg_api.sha256(c.certificate_no || '|' || c.applicant_id || '|' || c.type_id || '|' || c.issuer_id || '|' ||
                          c.title || '|' || TO_CHAR(c.issue_date, 'YYYY-MM-DD') || '|' || TO_CHAR(c.expiry_date, 'YYYY-MM-DD'));
  END;

  FUNCTION compute_signature(p_hash VARCHAR2, p_issuer_id NUMBER) RETURN VARCHAR2 IS
    l_secret issuer_secret.secret_key%TYPE;
  BEGIN
    SELECT secret_key INTO l_secret FROM issuer_secret WHERE issuer_id = p_issuer_id;
    RETURN pkg_api.sha256(p_hash || '|' || l_secret);
  END;

  FUNCTION get_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_OBJECT(
      'certificate_id' VALUE d.certificate_id, 'certificate_no' VALUE d.certificate_no, 'title' VALUE d.title,
      'applicant_id' VALUE d.applicant_id, 'applicant_name' VALUE d.applicant_name,
      'type_id' VALUE d.type_id, 'type_name' VALUE d.type_name,
      'issuer_id' VALUE d.issuer_id, 'issuer_name' VALUE d.issuer_name, 'organisation' VALUE d.organisation,
      'issue_date'  VALUE TO_CHAR(d.issue_date, 'YYYY-MM-DD'),
      'expiry_date' VALUE TO_CHAR(d.expiry_date, 'YYYY-MM-DD'),
      'document_url' VALUE d.document_url, 'upload_certificate' VALUE d.upload_certificate,
      'qr_code' VALUE d.qr_code, 'digital_signature' VALUE d.digital_signature, 'certificate_hash' VALUE d.certificate_hash,
      'is_issued' VALUE CASE WHEN d.is_issued = 'Y' THEN 'true' ELSE 'false' END FORMAT JSON,
      'status' VALUE d.status,
      'revocation_reason' VALUE d.revocation_reason,
      'revoked_date' VALUE TO_CHAR(d.revoked_date, 'YYYY-MM-DD')
      RETURNING CLOB)
    INTO l FROM v_certificate_detail d WHERE d.certificate_id = p_id;
    RETURN l;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB IS
    n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO n FROM certificate c
     WHERE c.certificate_id = p_id
       AND (p_type = 'ADMIN' OR (c.is_issued = 'Y' AND (p_type <> 'APPLICANT' OR c.applicant_id = p_linked)));
    IF n = 0 THEN RETURN NULL; END IF;
    RETURN get_json(p_id);
  END;

  FUNCTION list_json(p_type VARCHAR2, p_linked NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(get_json(c.certificate_id) FORMAT JSON ORDER BY c.certificate_id DESC RETURNING CLOB)
      INTO l FROM certificate c
     WHERE p_type = 'ADMIN' OR (c.is_issued = 'Y' AND (p_type <> 'APPLICANT' OR c.applicant_id = p_linked));
    RETURN NVL(l, TO_CLOB('[]'));
  END;

  FUNCTION create_json(p_body CLOB) RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_title VARCHAR2(200) := o.get_string('title');
    l_app   NUMBER := o.get_number('applicant_id');
    l_type  NUMBER := o.get_number('type_id');
    l_iss   NUMBER := o.get_number('issuer_id');
    l_idate DATE   := TO_DATE(o.get_string('issue_date'),  'YYYY-MM-DD');
    l_edate DATE   := TO_DATE(o.get_string('expiry_date'), 'YYYY-MM-DD');
    l_doc   VARCHAR2(500) := o.get_string('document_url');
    l_upl   VARCHAR2(500) := o.get_string('upload_certificate');
    l_no    VARCHAR2(30);
    l_id    NUMBER;
  BEGIN
    l_no := 'DCVS-' || TO_CHAR(SYSDATE, 'YYYY') || '-' || LPAD(seq_cert_no.NEXTVAL, 3, '0');
    INSERT INTO certificate(certificate_no, title, applicant_id, type_id, issuer_id, issue_date, expiry_date,
                            document_url, upload_certificate)
    VALUES (l_no, l_title, l_app, l_type, l_iss, l_idate, l_edate, l_doc, l_upl)
    RETURNING certificate_id INTO l_id;
    RETURN get_json(l_id);
  END;

  FUNCTION update_json(p_id NUMBER, p_body CLOB) RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_title VARCHAR2(200) := o.get_string('title');
    l_app   NUMBER := o.get_number('applicant_id');
    l_type  NUMBER := o.get_number('type_id');
    l_iss   NUMBER := o.get_number('issuer_id');
    l_idate DATE   := TO_DATE(o.get_string('issue_date'),  'YYYY-MM-DD');
    l_edate DATE   := TO_DATE(o.get_string('expiry_date'), 'YYYY-MM-DD');
    l_doc   VARCHAR2(500) := o.get_string('document_url');
    l_upl   VARCHAR2(500) := o.get_string('upload_certificate');
    l_issued CHAR(1);
  BEGIN
    BEGIN
      SELECT is_issued INTO l_issued FROM certificate WHERE certificate_id = p_id FOR UPDATE;
    EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
    END;
    IF l_issued = 'Y' THEN
      RAISE_APPLICATION_ERROR(-20010, 'An issued certificate cannot be edited. Revoke it and issue a new one.');
    END IF;
    UPDATE certificate SET title = NVL(l_title, title), applicant_id = NVL(l_app, applicant_id),
      type_id = NVL(l_type, type_id), issuer_id = NVL(l_iss, issuer_id), issue_date = NVL(l_idate, issue_date),
      expiry_date = NVL(l_edate, expiry_date), document_url = NVL(l_doc, document_url),
      upload_certificate = NVL(l_upl, upload_certificate)
    WHERE certificate_id = p_id;
    RETURN get_json(p_id);
  END;

  PROCEDURE delete_row(p_id NUMBER) IS
  BEGIN
    DELETE FROM certificate WHERE certificate_id = p_id;   -- trigger blocks issued ones
    IF SQL%ROWCOUNT = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'Certificate not found'); END IF;
  END;

  FUNCTION issue(p_id NUMBER) RETURN CLOB IS
    c certificate%ROWTYPE;
    l_hash VARCHAR2(64);
    l_base VARCHAR2(500);
  BEGIN
    BEGIN
      SELECT * INTO c FROM certificate WHERE certificate_id = p_id FOR UPDATE;
    EXCEPTION WHEN NO_DATA_FOUND THEN RAISE_APPLICATION_ERROR(-20404, 'Certificate not found');
    END;
    IF c.is_issued = 'Y' THEN RAISE_APPLICATION_ERROR(-20011, 'Certificate is already issued'); END IF;
    UPDATE certificate SET issue_date = NVL(issue_date, TRUNC(SYSDATE)) WHERE certificate_id = p_id;
    l_hash := compute_hash(p_id);
    BEGIN
      SELECT cfg_value INTO l_base FROM app_config WHERE cfg_key = 'VERIFY_BASE_URL';
    EXCEPTION WHEN NO_DATA_FOUND THEN l_base := 'http://localhost:5173/verify?ref=';
    END;
    UPDATE certificate SET certificate_hash = l_hash,
                           digital_signature = compute_signature(l_hash, c.issuer_id),
                           qr_code = l_base || c.certificate_no,
                           is_issued = 'Y'
     WHERE certificate_id = p_id;
    RETURN get_json(p_id);
  END;

  FUNCTION qr_json(p_id NUMBER) RETURN CLOB IS
    l_no certificate.certificate_no%TYPE;
    l_base VARCHAR2(500);
    o JSON_OBJECT_T := JSON_OBJECT_T();
  BEGIN
    SELECT certificate_no INTO l_no FROM certificate WHERE certificate_id = p_id AND is_issued = 'Y';
    BEGIN
      SELECT cfg_value INTO l_base FROM app_config WHERE cfg_key = 'VERIFY_BASE_URL';
    EXCEPTION WHEN NO_DATA_FOUND THEN l_base := 'http://localhost:5173/verify?ref=';
    END;
    o.put('certificate_no', l_no);
    o.put('verify_url', l_base || l_no);
    RETURN o.to_clob;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;
  FUNCTION check_json(p_id NUMBER) RETURN CLOB IS
    c certificate%ROWTYPE;
    o JSON_OBJECT_T := JSON_OBJECT_T();
    l_new VARCHAR2(64);
    l_hv BOOLEAN := FALSE; l_sv BOOLEAN := FALSE;
  BEGIN
    SELECT * INTO c FROM certificate WHERE certificate_id = p_id;
    IF c.is_issued = 'Y' THEN
      l_new := compute_hash(p_id);
      l_hv  := (l_new = c.certificate_hash);
      l_sv  := (compute_signature(l_new, c.issuer_id) = c.digital_signature);
    END IF;
    o.put('certificate_hash',  c.certificate_hash);
    o.put('digital_signature', c.digital_signature);
    o.put('hash_valid', l_hv);
    o.put('signature_valid', l_sv);
    RETURN o.to_clob;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;
END pkg_certificate;
/

-------------------------------------------------------------------------------
-- PKG_REVOCATION
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_revocation AS
  FUNCTION get_json(p_id NUMBER) RETURN CLOB;
  FUNCTION list_json RETURN CLOB;
  FUNCTION revoke(p_certificate_id NUMBER, p_reason VARCHAR2, p_revoked_by NUMBER) RETURN CLOB;
END pkg_revocation;
/
CREATE OR REPLACE PACKAGE BODY pkg_revocation AS
  FUNCTION get_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_OBJECT('revocation_id' VALUE r.revocation_id, 'certificate_id' VALUE r.certificate_id,
                       'certificate_no' VALUE d.certificate_no, 'title' VALUE d.title,
                       'applicant_name' VALUE d.applicant_name, 'reason' VALUE r.reason,
                       'revoked_date' VALUE TO_CHAR(r.revoked_date, 'YYYY-MM-DD'), 'revoked_by' VALUE r.revoked_by
                       RETURNING CLOB)
      INTO l FROM revocation r JOIN v_certificate_detail d ON d.certificate_id = r.certificate_id
     WHERE r.revocation_id = p_id;
    RETURN l;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION list_json RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(get_json(revocation_id) FORMAT JSON ORDER BY revocation_id DESC RETURNING CLOB)
      INTO l FROM revocation;
    RETURN NVL(l, TO_CLOB('[]'));
  END;

  FUNCTION revoke(p_certificate_id NUMBER, p_reason VARCHAR2, p_revoked_by NUMBER) RETURN CLOB IS
    l_issued CHAR(1);
    l_id NUMBER;
  BEGIN
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
      RAISE_APPLICATION_ERROR(-20030, 'A revocation reason of at least 5 characters is required');
    END IF;
    BEGIN
      SELECT is_issued INTO l_issued FROM certificate WHERE certificate_id = p_certificate_id FOR UPDATE;
    EXCEPTION WHEN NO_DATA_FOUND THEN RAISE_APPLICATION_ERROR(-20404, 'Certificate not found');
    END;
    IF l_issued <> 'Y' THEN RAISE_APPLICATION_ERROR(-20031, 'Only issued certificates can be revoked'); END IF;
    INSERT INTO revocation(certificate_id, reason, revoked_by) VALUES (p_certificate_id, TRIM(p_reason), p_revoked_by)
    RETURNING revocation_id INTO l_id;     -- duplicate => ORA-00001 => HTTP 409
    RETURN get_json(l_id);
  END;
END pkg_revocation;
/

-------------------------------------------------------------------------------
-- PKG_VERIFICATION : the decision flow  exists? -> revoked? -> expired? -> hash/signature?
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_verification AS
  FUNCTION verify(p_reference VARCHAR2, p_method VARCHAR2, p_verifier_id NUMBER,
                  p_ip VARCHAR2, p_user_agent VARCHAR2) RETURN CLOB;
  FUNCTION get_json(p_id NUMBER) RETURN CLOB;
  FUNCTION get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB;
  FUNCTION list_json(p_type VARCHAR2, p_linked NUMBER) RETURN CLOB;
END pkg_verification;
/
CREATE OR REPLACE PACKAGE BODY pkg_verification AS
  PROCEDURE log_it(p_cert NUMBER, p_ref VARCHAR2, p_ver NUMBER, p_ip VARCHAR2, p_ua VARCHAR2,
                   p_result VARCHAR2, p_method VARCHAR2, p_remarks VARCHAR2) IS
  BEGIN
    INSERT INTO verification(certificate_id, reference_text, verifier_id, user_agent, ip_address, result, method, remarks)
    VALUES (p_cert, SUBSTR(p_ref, 1, 100), p_ver, SUBSTR(p_ua, 1, 500), SUBSTR(p_ip, 1, 64), p_result, p_method, p_remarks);
  END;

  FUNCTION verify(p_reference VARCHAR2, p_method VARCHAR2, p_verifier_id NUMBER,
                  p_ip VARCHAR2, p_user_agent VARCHAR2) RETURN CLOB IS
    l_ref    VARCHAR2(100) := UPPER(TRIM(p_reference));
    l_method VARCHAR2(20)  := CASE WHEN UPPER(p_method) IN ('MANUAL','QR','API') THEN UPPER(p_method) ELSE 'MANUAL' END;
    c        v_certificate_detail%ROWTYPE;
    l_hash_ok BOOLEAN; l_sig_ok BOOLEAN;
    l_result VARCHAR2(20); l_remarks VARCHAR2(500);
    o JSON_OBJECT_T := JSON_OBJECT_T();
    cj JSON_OBJECT_T := JSON_OBJECT_T();
    l_new_hash VARCHAR2(64);
  BEGIN
    IF l_ref IS NULL THEN RAISE_APPLICATION_ERROR(-20050, 'Certificate reference is required'); END IF;
    BEGIN
      SELECT * INTO c FROM v_certificate_detail WHERE certificate_no = l_ref;
    EXCEPTION WHEN NO_DATA_FOUND THEN
      log_it(NULL, l_ref, p_verifier_id, p_ip, p_user_agent, 'INVALID', l_method, 'Certificate not found');
      o.put('success', TRUE); o.put('result', 'INVALID'); o.put('message', 'No certificate exists with this reference');
      o.put_null('certificate'); o.put_null('signature_valid'); o.put_null('hash_valid');
      RETURN o.to_clob;
    END;

    IF c.is_issued = 'Y' THEN
      l_new_hash := pkg_certificate.compute_hash(c.certificate_id);
      l_hash_ok  := (l_new_hash = c.certificate_hash);
      l_sig_ok   := (pkg_certificate.compute_signature(l_new_hash, c.issuer_id) = c.digital_signature);
    ELSE
      l_hash_ok := FALSE; l_sig_ok := FALSE;
    END IF;

    IF c.is_issued <> 'Y' THEN
      l_result := 'INVALID';  l_remarks := 'Certificate has not been issued';
    ELSIF c.status = 'REVOKED' THEN
      l_result := 'REVOKED';  l_remarks := 'Revoked on ' || TO_CHAR(c.revoked_date, 'YYYY-MM-DD');
    ELSIF c.status = 'EXPIRED' THEN
      l_result := 'EXPIRED';  l_remarks := 'Expired on ' || TO_CHAR(c.expiry_date, 'YYYY-MM-DD');
    ELSIF NOT (l_hash_ok AND l_sig_ok) THEN
      l_result := 'TAMPERED'; l_remarks := 'Hash or signature validation failed';
    ELSE
      l_result := 'VALID';    l_remarks := 'Hash and signature verified';
    END IF;

    log_it(c.certificate_id, l_ref, p_verifier_id, p_ip, p_user_agent, l_result, l_method, l_remarks);

    o.put('success', TRUE);
    o.put('result', l_result);
    o.put('message', l_remarks);
    IF l_result IN ('VALID','EXPIRED','REVOKED') THEN      -- public view: approved fields only
      cj.put('certificate_no',  c.certificate_no);
      cj.put('title',           c.title);
      cj.put('applicant_name',  c.applicant_name);
      cj.put('issuer_name',     c.issuer_name);
      cj.put('type_name',       c.type_name);
      cj.put('issue_date',      TO_CHAR(c.issue_date, 'YYYY-MM-DD'));
      IF c.expiry_date IS NULL THEN cj.put_null('expiry_date'); ELSE cj.put('expiry_date', TO_CHAR(c.expiry_date, 'YYYY-MM-DD')); END IF;
      o.put('certificate', cj);
    ELSE
      o.put_null('certificate');
    END IF;
    o.put('signature_valid', l_sig_ok);
    o.put('hash_valid', l_hash_ok);
    RETURN o.to_clob;
  END;

  FUNCTION get_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_OBJECT('verification_id' VALUE v.verification_id, 'certificate_id' VALUE v.certificate_id,
             'certificate_no' VALUE c.certificate_no, 'reference_text' VALUE v.reference_text,
             'verifier_id' VALUE v.verifier_id,
             'verifier_name' VALUE (SELECT x.first_name || ' ' || x.last_name FROM verifier x WHERE x.verifier_id = v.verifier_id),
             'verification_time' VALUE TO_CHAR(v.verification_time, 'YYYY-MM-DD"T"HH24:MI:SS'),
             'user_agent' VALUE v.user_agent, 'ip_address' VALUE v.ip_address, 'result' VALUE v.result,
             'method' VALUE v.method, 'remarks' VALUE v.remarks RETURNING CLOB)
      INTO l FROM verification v LEFT JOIN certificate c ON c.certificate_id = v.certificate_id
     WHERE v.verification_id = p_id;
    RETURN l;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB IS
    n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO n FROM verification v
     WHERE v.verification_id = p_id
       AND (p_type = 'ADMIN'
            OR (p_type = 'VERIFIER' AND v.verifier_id = p_linked)
            OR (p_type = 'HR' AND v.verifier_id IN (SELECT verifier_id FROM verifier WHERE hr_id = p_linked)));
    IF n = 0 THEN RETURN NULL; END IF;
    RETURN get_json(p_id);
  END;

  FUNCTION list_json(p_type VARCHAR2, p_linked NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(get_json(v.verification_id) FORMAT JSON ORDER BY v.verification_time DESC RETURNING CLOB)
      INTO l FROM verification v
     WHERE p_type = 'ADMIN'
        OR (p_type = 'VERIFIER' AND v.verifier_id = p_linked)
        OR (p_type = 'HR' AND v.verifier_id IN (SELECT verifier_id FROM verifier WHERE hr_id = p_linked));
    RETURN NVL(l, TO_CLOB('[]'));
  END;
END pkg_verification;
/

-------------------------------------------------------------------------------
-- PKG_DASHBOARD
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_dashboard AS
  FUNCTION stats_json RETURN CLOB;
  FUNCTION certificates_json RETURN CLOB;
  FUNCTION verifications_json RETURN CLOB;
END pkg_dashboard;
/
CREATE OR REPLACE PACKAGE BODY pkg_dashboard AS
  -- p_sql must return columns lbl, cnt
  FUNCTION agg(p_sql VARCHAR2) RETURN CLOB IS
    l CLOB;
  BEGIN
    EXECUTE IMMEDIATE
      'SELECT JSON_ARRAYAGG(JSON_OBJECT(''label'' VALUE lbl, ''count'' VALUE cnt) ORDER BY lbl RETURNING CLOB) FROM (' || p_sql || ')'
      INTO l;
    RETURN NVL(l, TO_CLOB('[]'));
  END;

  FUNCTION stats_json RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T();
    n_total NUMBER; n_valid NUMBER; n_exp NUMBER; n_rev NUMBER; n_draft NUMBER; n_ver NUMBER; n_app NUMBER; n_iss NUMBER; n_vrf NUMBER;
  BEGIN
    SELECT COUNT(*), COUNT(CASE WHEN status='VALID' THEN 1 END), COUNT(CASE WHEN status='EXPIRED' THEN 1 END),
           COUNT(CASE WHEN status='REVOKED' THEN 1 END), COUNT(CASE WHEN status='DRAFT' THEN 1 END)
      INTO n_total, n_valid, n_exp, n_rev, n_draft FROM v_certificate_detail;
    SELECT COUNT(*) INTO n_ver FROM verification;
    SELECT COUNT(*) INTO n_app FROM applicant;
    SELECT COUNT(*) INTO n_iss FROM issuer;
    SELECT COUNT(*) INTO n_vrf FROM verifier;
    o.put('total_certificates', n_total); o.put('valid', n_valid); o.put('expired', n_exp);
    o.put('revoked', n_rev); o.put('draft', n_draft); o.put('total_verifications', n_ver);
    o.put('total_applicants', n_app); o.put('total_issuers', n_iss); o.put('total_verifiers', n_vrf);
    RETURN o.to_clob;
  END;

  FUNCTION certificates_json RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T();
  BEGIN
    o.put('by_month',  JSON_ARRAY_T.parse(agg('SELECT TO_CHAR(issue_date,''YYYY-MM'') lbl, COUNT(*) cnt FROM certificate WHERE is_issued=''Y'' AND issue_date IS NOT NULL GROUP BY TO_CHAR(issue_date,''YYYY-MM'')')));
    o.put('by_type',   JSON_ARRAY_T.parse(agg('SELECT type_name lbl, COUNT(*) cnt FROM v_certificate_detail GROUP BY type_name')));
    o.put('by_issuer', JSON_ARRAY_T.parse(agg('SELECT issuer_name lbl, COUNT(*) cnt FROM v_certificate_detail GROUP BY issuer_name')));
    o.put('by_status', JSON_ARRAY_T.parse(agg('SELECT status lbl, COUNT(*) cnt FROM v_certificate_detail GROUP BY status')));
    RETURN o.to_clob;
  END;

  FUNCTION verifications_json RETURN CLOB IS
    o JSON_OBJECT_T := JSON_OBJECT_T();
  BEGIN
    o.put('by_day',    JSON_ARRAY_T.parse(agg('SELECT TO_CHAR(verification_time,''YYYY-MM-DD'') lbl, COUNT(*) cnt FROM verification WHERE verification_time >= SYSTIMESTAMP - INTERVAL ''30'' DAY GROUP BY TO_CHAR(verification_time,''YYYY-MM-DD'')')));
    o.put('by_result', JSON_ARRAY_T.parse(agg('SELECT result lbl, COUNT(*) cnt FROM verification GROUP BY result')));
    o.put('by_method', JSON_ARRAY_T.parse(agg('SELECT method lbl, COUNT(*) cnt FROM verification GROUP BY method')));
    RETURN o.to_clob;
  END;
END pkg_dashboard;
/

-- FINAL PATCH: request-body conversion helper (merged from former 10_patch_pkg_api.sql)
-- 10_patch_pkg_api.sql : adds body_clob (reads the JSON request body). Run, then re-run 09_ords_modules.sql
CREATE OR REPLACE PACKAGE pkg_api AS
  FUNCTION  sha256(p_text IN VARCHAR2) RETURN VARCHAR2;
  FUNCTION  ok(p_data IN CLOB) RETURN CLOB;
  FUNCTION  body_clob(p_body IN BLOB) RETURN CLOB;
  PROCEDURE json_out(p_json IN CLOB);
  PROCEDURE error_out(p_message IN VARCHAR2);
  FUNCTION  status_for(p_sqlcode IN NUMBER) RETURN NUMBER;
  FUNCTION  clean_msg(p_msg IN VARCHAR2) RETURN VARCHAR2;
END pkg_api;
/
CREATE OR REPLACE PACKAGE BODY pkg_api AS
  FUNCTION sha256(p_text IN VARCHAR2) RETURN VARCHAR2 IS
    l VARCHAR2(64);
  BEGIN
    SELECT LOWER(RAWTOHEX(STANDARD_HASH(p_text, 'SHA256'))) INTO l FROM dual;
    RETURN l;
  END;

  FUNCTION ok(p_data IN CLOB) RETURN CLOB IS
  BEGIN
    RETURN '{"success":true,"data":' || NVL(p_data, TO_CLOB('null')) || '}';
  END;

  FUNCTION body_clob(p_body IN BLOB) RETURN CLOB IS
    l_clob CLOB;
    l_dest PLS_INTEGER := 1;
    l_src  PLS_INTEGER := 1;
    l_ctx  PLS_INTEGER := DBMS_LOB.DEFAULT_LANG_CTX;
    l_warn PLS_INTEGER;
  BEGIN
    IF p_body IS NULL OR DBMS_LOB.GETLENGTH(p_body) = 0 THEN RETURN NULL; END IF;
    DBMS_LOB.CREATETEMPORARY(l_clob, TRUE);
    DBMS_LOB.CONVERTTOCLOB(l_clob, p_body, DBMS_LOB.LOBMAXSIZE, l_dest, l_src, 873, l_ctx, l_warn);  -- 873 = AL32UTF8
    RETURN l_clob;
  END;

  PROCEDURE json_out(p_json IN CLOB) IS
    l_pos PLS_INTEGER := 1;
    l_len PLS_INTEGER := NVL(DBMS_LOB.GETLENGTH(p_json), 0);
  BEGIN
    OWA_UTIL.MIME_HEADER('application/json', TRUE, 'UTF-8');
    WHILE l_pos <= l_len LOOP
      HTP.PRN(DBMS_LOB.SUBSTR(p_json, 4000, l_pos));
      l_pos := l_pos + 4000;
    END LOOP;
  END;

  PROCEDURE error_out(p_message IN VARCHAR2) IS
    l VARCHAR2(4000);
  BEGIN
    SELECT JSON_OBJECT('success' VALUE 'false' FORMAT JSON, 'error' VALUE SUBSTR(p_message,1,1000))
      INTO l FROM dual;
    json_out(TO_CLOB(l));
  END;

  FUNCTION status_for(p_sqlcode IN NUMBER) RETURN NUMBER IS
  BEGIN
    RETURN CASE
      WHEN p_sqlcode IN (-1, -2292)                     THEN 409   -- duplicate / referenced by other rows
      WHEN p_sqlcode IN (-20404, 100)                   THEN 404
      WHEN p_sqlcode BETWEEN -20999 AND -20000          THEN 400   -- our own validation errors
      WHEN p_sqlcode IN (-1400,-1407,-1438,-1722,-1840,-1843,-1847,-1858,-1861,-2290,-2291,-6502,-12899) THEN 400
      WHEN p_sqlcode BETWEEN -40500 AND -40400          THEN 400   -- malformed JSON
      ELSE 500 END;
  END;

  FUNCTION clean_msg(p_msg IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    RETURN REGEXP_REPLACE(SUBSTR(p_msg, 1, INSTR(p_msg || CHR(10), CHR(10)) - 1), '^ORA-[0-9]+: ', '');
  END;
END pkg_api;
/


-- FINAL PATCH: revocation API naming and implementation (merged from former 12_patch_revocation.sql)
-- 12_patch_revocation.sql : fixes PKG_REVOCATION (REVOKE is a reserved word; function is now revoke_cert)
CREATE OR REPLACE PACKAGE pkg_revocation AS
  FUNCTION get_json(p_id NUMBER) RETURN CLOB;
  FUNCTION list_json RETURN CLOB;
  FUNCTION revoke_cert(p_certificate_id NUMBER, p_reason VARCHAR2, p_revoked_by NUMBER) RETURN CLOB;
END pkg_revocation;
/
CREATE OR REPLACE PACKAGE BODY pkg_revocation AS
  FUNCTION get_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_OBJECT('revocation_id' VALUE r.revocation_id, 'certificate_id' VALUE r.certificate_id,
                       'certificate_no' VALUE d.certificate_no, 'title' VALUE d.title,
                       'applicant_name' VALUE d.applicant_name, 'reason' VALUE r.reason,
                       'revoked_date' VALUE TO_CHAR(r.revoked_date, 'YYYY-MM-DD'), 'revoked_by' VALUE r.revoked_by
                       RETURNING CLOB)
      INTO l FROM revocation r JOIN v_certificate_detail d ON d.certificate_id = r.certificate_id
     WHERE r.revocation_id = p_id;
    RETURN l;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION list_json RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(get_json(revocation_id) FORMAT JSON ORDER BY revocation_id DESC RETURNING CLOB)
      INTO l FROM revocation;
    RETURN NVL(l, TO_CLOB('[]'));
  END;

  FUNCTION revoke_cert(p_certificate_id NUMBER, p_reason VARCHAR2, p_revoked_by NUMBER) RETURN CLOB IS
    l_issued CHAR(1);
    l_id NUMBER;
  BEGIN
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
      RAISE_APPLICATION_ERROR(-20030, 'A revocation reason of at least 5 characters is required');
    END IF;
    BEGIN
      SELECT is_issued INTO l_issued FROM certificate WHERE certificate_id = p_certificate_id FOR UPDATE;
    EXCEPTION WHEN NO_DATA_FOUND THEN RAISE_APPLICATION_ERROR(-20404, 'Certificate not found');
    END;
    IF l_issued <> 'Y' THEN RAISE_APPLICATION_ERROR(-20031, 'Only issued certificates can be revoked'); END IF;
    INSERT INTO revocation(certificate_id, reason, revoked_by) VALUES (p_certificate_id, TRIM(p_reason), p_revoked_by)
    RETURNING revocation_id INTO l_id;     -- duplicate => ORA-00001 => HTTP 409
    RETURN get_json(l_id);
  END;
END pkg_revocation;
/


-- FINAL PATCH: applicant/verifier multivalued contacts (merged from former 13_patch_contacts.sql)
-- 13_patch_contacts.sql : fixes email/phone saving in PKG_APPLICANT and PKG_VERIFIER (ORA-40573)
-------------------------------------------------------------------------------
-- PKG_APPLICANT
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_applicant AS
  FUNCTION  get_json(p_id NUMBER) RETURN CLOB;
  FUNCTION  get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB;
  FUNCTION  list_json RETURN CLOB;
  FUNCTION  create_json(p_body CLOB) RETURN CLOB;
  FUNCTION  update_json(p_id NUMBER, p_body CLOB) RETURN CLOB;
  PROCEDURE delete_row(p_id NUMBER);
END pkg_applicant;
/
CREATE OR REPLACE PACKAGE BODY pkg_applicant AS
  PROCEDURE save_contacts(p_id NUMBER, o JSON_OBJECT_T) IS
    a JSON_ARRAY_T;
    l_val VARCHAR2(150);
  BEGIN
    IF o.has('emails') THEN
      DELETE FROM applicant_email WHERE applicant_id = p_id;
      a := o.get_array('emails');
      IF a IS NOT NULL THEN
        FOR i IN 0 .. a.get_size - 1 LOOP
          l_val := TRIM(a.get_string(i));
          INSERT INTO applicant_email(applicant_id, email) VALUES (p_id, l_val);
        END LOOP;
      END IF;
    END IF;
    IF o.has('phones') THEN
      DELETE FROM applicant_phone WHERE applicant_id = p_id;
      a := o.get_array('phones');
      IF a IS NOT NULL THEN
        FOR i IN 0 .. a.get_size - 1 LOOP
          l_val := TRIM(a.get_string(i));
          INSERT INTO applicant_phone(applicant_id, phone) VALUES (p_id, l_val);
        END LOOP;
      END IF;
    END IF;
  END;

  FUNCTION get_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_OBJECT(
      'applicant_id' VALUE a.applicant_id,
      'first_name'   VALUE a.first_name,
      'middle_name'  VALUE a.middle_name,
      'last_name'    VALUE a.last_name,
      'full_name'    VALUE a.first_name || NVL2(a.middle_name, ' '||a.middle_name, '') || ' ' || a.last_name,
      'dob'          VALUE TO_CHAR(a.dob, 'YYYY-MM-DD'),
      'aadhar_card'  VALUE a.aadhar_card,
      'street'       VALUE a.street,
      'city'         VALUE a.city,
      'state'        VALUE a.state,
      'pincode'      VALUE a.pincode,
      'emails' VALUE NVL((SELECT JSON_ARRAYAGG(e.email ORDER BY e.email RETURNING CLOB)
                            FROM applicant_email e WHERE e.applicant_id = a.applicant_id), TO_CLOB('[]')) FORMAT JSON,
      'phones' VALUE NVL((SELECT JSON_ARRAYAGG(p.phone ORDER BY p.phone RETURNING CLOB)
                            FROM applicant_phone p WHERE p.applicant_id = a.applicant_id), TO_CLOB('[]')) FORMAT JSON
      RETURNING CLOB)
    INTO l FROM applicant a WHERE a.applicant_id = p_id;
    RETURN l;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB IS
  BEGIN
    IF p_type = 'APPLICANT' AND p_linked <> p_id THEN RETURN NULL; END IF;
    IF p_type NOT IN ('ADMIN','HR','VERIFIER','APPLICANT') THEN RETURN NULL; END IF;
    RETURN get_json(p_id);
  END;

  FUNCTION list_json RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(get_json(applicant_id) FORMAT JSON ORDER BY applicant_id RETURNING CLOB)
      INTO l FROM applicant;
    RETURN NVL(l, TO_CLOB('[]'));
  END;

  FUNCTION create_json(p_body CLOB) RETURN CLOB IS
    o  JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_fn VARCHAR2(50)  := o.get_string('first_name');
    l_mn VARCHAR2(50)  := o.get_string('middle_name');
    l_ln VARCHAR2(50)  := o.get_string('last_name');
    l_dob DATE         := TO_DATE(o.get_string('dob'), 'YYYY-MM-DD');
    l_aad VARCHAR2(12) := o.get_string('aadhar_card');
    l_st VARCHAR2(150) := o.get_string('street');
    l_ci VARCHAR2(80)  := o.get_string('city');
    l_sa VARCHAR2(80)  := o.get_string('state');
    l_pi VARCHAR2(6)   := o.get_string('pincode');
    l_user VARCHAR2(100) := o.get_string('username');
    l_id NUMBER;
  BEGIN
    INSERT INTO applicant(first_name, middle_name, last_name, dob, aadhar_card, street, city, state, pincode)
    VALUES (l_fn, l_mn, l_ln, l_dob, l_aad, l_st, l_ci, l_sa, l_pi)
    RETURNING applicant_id INTO l_id;
    save_contacts(l_id, o);
    IF l_user IS NOT NULL THEN
      pkg_auth.create_account(l_user, o.get_string('password'), 'APPLICANT', l_id);
    END IF;
    RETURN get_json(l_id);
  END;

  FUNCTION update_json(p_id NUMBER, p_body CLOB) RETURN CLOB IS
    o  JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_fn VARCHAR2(50)  := o.get_string('first_name');
    l_mn VARCHAR2(50)  := o.get_string('middle_name');
    l_ln VARCHAR2(50)  := o.get_string('last_name');
    l_dob DATE         := TO_DATE(o.get_string('dob'), 'YYYY-MM-DD');
    l_aad VARCHAR2(12) := o.get_string('aadhar_card');
    l_st VARCHAR2(150) := o.get_string('street');
    l_ci VARCHAR2(80)  := o.get_string('city');
    l_sa VARCHAR2(80)  := o.get_string('state');
    l_pi VARCHAR2(6)   := o.get_string('pincode');
  BEGIN
    UPDATE applicant SET
      first_name = NVL(l_fn, first_name), middle_name = NVL(l_mn, middle_name), last_name = NVL(l_ln, last_name),
      dob = NVL(l_dob, dob), aadhar_card = NVL(l_aad, aadhar_card), street = NVL(l_st, street),
      city = NVL(l_ci, city), state = NVL(l_sa, state), pincode = NVL(l_pi, pincode)
    WHERE applicant_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RETURN NULL; END IF;
    save_contacts(p_id, o);
    RETURN get_json(p_id);
  END;

  PROCEDURE delete_row(p_id NUMBER) IS
  BEGIN
    DELETE FROM applicant WHERE applicant_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'Applicant not found'); END IF;
  END;
END pkg_applicant;
/

-------------------------------------------------------------------------------
-- PKG_VERIFIER  (declared before PKG_HR because HR lists its verifiers)
-------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE pkg_verifier AS
  FUNCTION  get_json(p_id NUMBER) RETURN CLOB;
  FUNCTION  get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB;
  FUNCTION  list_json(p_type VARCHAR2, p_linked NUMBER) RETURN CLOB;
  FUNCTION  create_json(p_body CLOB) RETURN CLOB;
  FUNCTION  update_json(p_id NUMBER, p_body CLOB, p_is_admin BOOLEAN) RETURN CLOB;
  PROCEDURE delete_row(p_id NUMBER);
END pkg_verifier;
/
CREATE OR REPLACE PACKAGE BODY pkg_verifier AS
  PROCEDURE save_contacts(p_id NUMBER, o JSON_OBJECT_T) IS
    a JSON_ARRAY_T;
    l_val VARCHAR2(150);
  BEGIN
    IF o.has('emails') THEN
      DELETE FROM verifier_email WHERE verifier_id = p_id;
      a := o.get_array('emails');
      IF a IS NOT NULL THEN
        FOR i IN 0 .. a.get_size - 1 LOOP
          l_val := TRIM(a.get_string(i));
          INSERT INTO verifier_email(verifier_id, email) VALUES (p_id, l_val);
        END LOOP;
      END IF;
    END IF;
    IF o.has('phones') THEN
      DELETE FROM verifier_phone WHERE verifier_id = p_id;
      a := o.get_array('phones');
      IF a IS NOT NULL THEN
        FOR i IN 0 .. a.get_size - 1 LOOP
          l_val := TRIM(a.get_string(i));
          INSERT INTO verifier_phone(verifier_id, phone) VALUES (p_id, l_val);
        END LOOP;
      END IF;
    END IF;
  END;

  FUNCTION get_json(p_id NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_OBJECT(
      'verifier_id'   VALUE v.verifier_id,
      'first_name'    VALUE v.first_name,
      'middle_name'   VALUE v.middle_name,
      'last_name'     VALUE v.last_name,
      'full_name'     VALUE v.first_name || NVL2(v.middle_name, ' '||v.middle_name, '') || ' ' || v.last_name,
      'aadhar_card'   VALUE v.aadhar_card,
      'doj'           VALUE TO_CHAR(v.doj, 'YYYY-MM-DD'),
      'role'          VALUE v.verifier_role,
      'organization'  VALUE v.organization,
      'verifier_type' VALUE v.verifier_type,
      'street' VALUE v.street, 'city' VALUE v.city, 'state' VALUE v.state, 'pincode' VALUE v.pincode,
      'hr_id'         VALUE v.hr_id,
      'emails' VALUE NVL((SELECT JSON_ARRAYAGG(e.email ORDER BY e.email RETURNING CLOB)
                            FROM verifier_email e WHERE e.verifier_id = v.verifier_id), TO_CLOB('[]')) FORMAT JSON,
      'phones' VALUE NVL((SELECT JSON_ARRAYAGG(p.phone ORDER BY p.phone RETURNING CLOB)
                            FROM verifier_phone p WHERE p.verifier_id = v.verifier_id), TO_CLOB('[]')) FORMAT JSON
      RETURNING CLOB)
    INTO l FROM verifier v WHERE v.verifier_id = p_id;
    RETURN l;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION get_scoped(p_id NUMBER, p_type VARCHAR2, p_linked NUMBER) RETURN CLOB IS
    n NUMBER;
  BEGIN
    IF p_type = 'ADMIN' THEN RETURN get_json(p_id); END IF;
    IF p_type = 'VERIFIER' THEN
      IF p_linked = p_id THEN RETURN get_json(p_id); ELSE RETURN NULL; END IF;
    END IF;
    IF p_type = 'HR' THEN
      SELECT COUNT(*) INTO n FROM verifier WHERE verifier_id = p_id AND hr_id = p_linked;
      IF n = 1 THEN RETURN get_json(p_id); END IF;
    END IF;
    RETURN NULL;
  END;

  FUNCTION list_json(p_type VARCHAR2, p_linked NUMBER) RETURN CLOB IS
    l CLOB;
  BEGIN
    SELECT JSON_ARRAYAGG(get_json(v.verifier_id) FORMAT JSON ORDER BY v.verifier_id RETURNING CLOB)
      INTO l FROM verifier v
     WHERE p_type = 'ADMIN' OR (p_type = 'HR' AND v.hr_id = p_linked);
    RETURN NVL(l, TO_CLOB('[]'));
  END;

  FUNCTION create_json(p_body CLOB) RETURN CLOB IS
    o  JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_fn  VARCHAR2(50)  := o.get_string('first_name');
    l_mn  VARCHAR2(50)  := o.get_string('middle_name');
    l_ln  VARCHAR2(50)  := o.get_string('last_name');
    l_aad VARCHAR2(12)  := o.get_string('aadhar_card');
    l_doj DATE          := TO_DATE(o.get_string('doj'), 'YYYY-MM-DD');
    l_rol VARCHAR2(80)  := o.get_string('role');
    l_org VARCHAR2(200) := o.get_string('organization');
    l_typ VARCHAR2(50)  := o.get_string('verifier_type');
    l_st  VARCHAR2(150) := o.get_string('street');
    l_ci  VARCHAR2(80)  := o.get_string('city');
    l_sa  VARCHAR2(80)  := o.get_string('state');
    l_pi  VARCHAR2(6)   := o.get_string('pincode');
    l_hr  NUMBER        := o.get_number('hr_id');
    l_user VARCHAR2(100) := o.get_string('username');
    l_id NUMBER;
  BEGIN
    INSERT INTO verifier(first_name, middle_name, last_name, aadhar_card, doj, verifier_role, organization,
                         verifier_type, street, city, state, pincode, hr_id)
    VALUES (l_fn, l_mn, l_ln, l_aad, l_doj, l_rol, l_org, l_typ, l_st, l_ci, l_sa, l_pi, l_hr)
    RETURNING verifier_id INTO l_id;
    save_contacts(l_id, o);
    IF l_user IS NOT NULL THEN
      pkg_auth.create_account(l_user, o.get_string('password'), 'VERIFIER', l_id);
    END IF;
    RETURN get_json(l_id);
  END;

  FUNCTION update_json(p_id NUMBER, p_body CLOB, p_is_admin BOOLEAN) RETURN CLOB IS
    o  JSON_OBJECT_T := JSON_OBJECT_T.parse(p_body);
    l_fn  VARCHAR2(50)  := o.get_string('first_name');
    l_mn  VARCHAR2(50)  := o.get_string('middle_name');
    l_ln  VARCHAR2(50)  := o.get_string('last_name');
    l_aad VARCHAR2(12)  := o.get_string('aadhar_card');
    l_doj DATE          := TO_DATE(o.get_string('doj'), 'YYYY-MM-DD');
    l_rol VARCHAR2(80)  := o.get_string('role');
    l_org VARCHAR2(200) := o.get_string('organization');
    l_typ VARCHAR2(50)  := o.get_string('verifier_type');
    l_st  VARCHAR2(150) := o.get_string('street');
    l_ci  VARCHAR2(80)  := o.get_string('city');
    l_sa  VARCHAR2(80)  := o.get_string('state');
    l_pi  VARCHAR2(6)   := o.get_string('pincode');
    l_hr  NUMBER        := CASE WHEN p_is_admin THEN o.get_number('hr_id') ELSE NULL END;  -- only admin may re-assign HR
  BEGIN
    UPDATE verifier SET first_name = NVL(l_fn, first_name), middle_name = NVL(l_mn, middle_name),
      last_name = NVL(l_ln, last_name), aadhar_card = NVL(l_aad, aadhar_card), doj = NVL(l_doj, doj),
      verifier_role = NVL(l_rol, verifier_role), organization = NVL(l_org, organization),
      verifier_type = NVL(l_typ, verifier_type), street = NVL(l_st, street), city = NVL(l_ci, city),
      state = NVL(l_sa, state), pincode = NVL(l_pi, pincode), hr_id = NVL(l_hr, hr_id)
    WHERE verifier_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RETURN NULL; END IF;
    save_contacts(p_id, o);
    RETURN get_json(p_id);
  END;

  PROCEDURE delete_row(p_id NUMBER) IS
  BEGIN
    DELETE FROM verifier WHERE verifier_id = p_id;
    IF SQL%ROWCOUNT = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'Verifier not found'); END IF;
  END;
END pkg_verifier;
/

