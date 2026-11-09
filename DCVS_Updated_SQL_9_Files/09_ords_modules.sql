-- 09_ords_modules.sql : the complete REST API (module dcvs.api, base path /api/).
-- PREREQUISITE: schema already REST-enabled (ORDS.ENABLE_SCHEMA) and 05_packages.sql compiled.
-- Re-runnable: it deletes and recreates the module.
-- CORS (allowed website addresses) is set in a separate small block right after the module is created.
-- For local development with the Vite proxy you do not need CORS at all.

BEGIN
  BEGIN ORDS.DELETE_MODULE(p_module_name => 'dcvs.api'); EXCEPTION WHEN OTHERS THEN NULL; END;
  ORDS.DEFINE_MODULE(
    p_module_name    => 'dcvs.api',
    p_base_path      => '/api/',
    p_items_per_page => 25,
    p_status         => 'PUBLISHED');
END;
/
-- CORS: change the address(es) before deploying. If this block errors on your ORDS version, ignore it for local use.
BEGIN
  ORDS.SET_MODULE_ORIGINS_ALLOWED(p_module_name => 'dcvs.api', p_origins_allowed => 'http://localhost:5173');
END;
/
BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'ping');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'ping', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  pkg_api.json_out(TO_CLOB('{"success":true,"message":"DCVS API is running"}'));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'health');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'health', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~BEGIN
  pkg_api.json_out(TO_CLOB('{"success":true,"message":"DCVS API is running"}'));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'auth/login');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'auth/login', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_row := pkg_auth.login(JSON_OBJECT_T.parse(pkg_api.body_clob(:body)).get_string('username'),
                          JSON_OBJECT_T.parse(pkg_api.body_clob(:body)).get_string('password'));
  IF l_row IS NULL THEN :status_code := 401; pkg_api.error_out('Invalid username or password'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'auth/logout');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'auth/logout', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  pkg_auth.logout(:auth_token);
  pkg_api.json_out(TO_CLOB('{"success":true}'));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'auth/logout', p_method => 'POST',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'auth/me');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'auth/me', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, NULL);
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_auth.me_json));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'auth/me', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'types');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'types', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER,APPLICANT');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_cert_type.list_json));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'types', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'types/:id');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'types/:id', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER,APPLICANT');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_cert_type.get_json(:id);
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'types/:id', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'types', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_cert_type.create_json(pkg_api.body_clob(:body));
  :status_code := 201;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'types', p_method => 'POST',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'types/:id', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_cert_type.update_json(:id, pkg_api.body_clob(:body));
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'types/:id', p_method => 'PUT',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'types/:id', p_method => 'DELETE',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_cert_type.delete_row(:id);
  pkg_api.json_out(TO_CLOB('{"success":true}'));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'types/:id', p_method => 'DELETE',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'issuers');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'issuers', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_issuer.list_json));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'issuers', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'issuers/:id');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'issuers/:id', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_issuer.get_json(:id);
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'issuers/:id', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'issuers', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_issuer.create_json(pkg_api.body_clob(:body));
  :status_code := 201;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'issuers', p_method => 'POST',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'issuers/:id', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_issuer.update_json(:id, pkg_api.body_clob(:body));
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'issuers/:id', p_method => 'PUT',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'issuers/:id', p_method => 'DELETE',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_issuer.delete_row(:id);
  pkg_api.json_out(TO_CLOB('{"success":true}'));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'issuers/:id', p_method => 'DELETE',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'issuers/:id/certificates');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'issuers/:id/certificates', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_issuer.certificates_json(:id)));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'issuers/:id/certificates', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'applicants');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'applicants', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_applicant.list_json));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'applicants', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'applicants/:id');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'applicants/:id', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER,APPLICANT');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_applicant.get_scoped(:id, pkg_auth.g_user_type, pkg_auth.g_linked_id);
  IF l_row IS NULL THEN :status_code := 403; pkg_api.error_out('Access denied'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'applicants/:id', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'applicants', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_applicant.create_json(pkg_api.body_clob(:body));
  :status_code := 201;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'applicants', p_method => 'POST',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'applicants/:id', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,APPLICANT');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  IF pkg_auth.g_user_type = 'APPLICANT' AND NOT pkg_auth.is_self('APPLICANT', :id) THEN
    :status_code := 403; pkg_api.error_out('You can only edit your own profile'); RETURN;
  END IF;
  l_row := pkg_applicant.update_json(:id, pkg_api.body_clob(:body));
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'applicants/:id', p_method => 'PUT',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'applicants/:id', p_method => 'DELETE',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_applicant.delete_row(:id);
  pkg_api.json_out(TO_CLOB('{"success":true}'));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'applicants/:id', p_method => 'DELETE',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'applicants/:id/certificates');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'applicants/:id/certificates', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER,APPLICANT');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  IF pkg_auth.g_user_type = 'APPLICANT' AND NOT pkg_auth.is_self('APPLICANT', :id) THEN
    :status_code := 403; pkg_api.error_out('Access denied'); RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_certificate.list_json('APPLICANT', :id)));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'applicants/:id/certificates', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'certificates');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'certificates', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER,APPLICANT');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_certificate.list_json(pkg_auth.g_user_type, pkg_auth.g_linked_id)));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'certificates', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'certificates/:id', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER,APPLICANT');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_certificate.get_scoped(:id, pkg_auth.g_user_type, pkg_auth.g_linked_id);
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'certificates', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_certificate.create_json(pkg_api.body_clob(:body));
  :status_code := 201;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'certificates', p_method => 'POST',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'certificates/:id', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_certificate.update_json(:id, pkg_api.body_clob(:body));
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id', p_method => 'PUT',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'certificates/:id', p_method => 'DELETE',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_certificate.delete_row(:id);
  pkg_api.json_out(TO_CLOB('{"success":true}'));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id', p_method => 'DELETE',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/issue');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/issue', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_certificate.issue(:id);
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/issue', p_method => 'POST',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/revoke');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/revoke', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_revocation.revoke_cert(:id, JSON_OBJECT_T.parse(pkg_api.body_clob(:body)).get_string('reason'), pkg_auth.g_account_id);
  :status_code := 201;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/revoke', p_method => 'POST',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/qr');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/qr', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER,APPLICANT');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  IF pkg_certificate.get_scoped(:id, pkg_auth.g_user_type, pkg_auth.g_linked_id) IS NULL THEN
    :status_code := 404; pkg_api.error_out('Not found'); RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_certificate.qr_json(:id)));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/qr', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/signature');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/signature', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_certificate.check_json(:id);
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'certificates/:id/signature', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'revocations');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'revocations', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_revocation.list_json));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'revocations', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'revocations/:id');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'revocations/:id', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_revocation.get_json(:id);
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'revocations/:id', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'verifiers');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'verifiers', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_verifier.list_json(pkg_auth.g_user_type, pkg_auth.g_linked_id)));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'verifiers', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'verifiers/:id');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'verifiers/:id', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_verifier.get_scoped(:id, pkg_auth.g_user_type, pkg_auth.g_linked_id);
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'verifiers/:id', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'verifiers', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_verifier.create_json(pkg_api.body_clob(:body));
  :status_code := 201;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'verifiers', p_method => 'POST',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'verifiers/:id', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  IF pkg_verifier.get_scoped(:id, pkg_auth.g_user_type, pkg_auth.g_linked_id) IS NULL THEN
    :status_code := 404; pkg_api.error_out('Not found'); RETURN;
  END IF;
  l_row := pkg_verifier.update_json(:id, pkg_api.body_clob(:body), pkg_auth.g_user_type = 'ADMIN');
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'verifiers/:id', p_method => 'PUT',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'verifiers/:id', p_method => 'DELETE',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_verifier.delete_row(:id);
  pkg_api.json_out(TO_CLOB('{"success":true}'));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'verifiers/:id', p_method => 'DELETE',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'verifiers/:id/verifications');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'verifiers/:id/verifications', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  IF pkg_verifier.get_scoped(:id, pkg_auth.g_user_type, pkg_auth.g_linked_id) IS NULL THEN
    :status_code := 404; pkg_api.error_out('Not found'); RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_verification.list_json('VERIFIER', :id)));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'verifiers/:id/verifications', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'hr');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'hr', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_hr.list_json));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'hr', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'hr/:id');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'hr/:id', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_hr.get_scoped(:id, pkg_auth.g_user_type, pkg_auth.g_linked_id);
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'hr/:id', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'hr', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_hr.create_json(pkg_api.body_clob(:body));
  :status_code := 201;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'hr', p_method => 'POST',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'hr/:id', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_hr.update_json(:id, pkg_api.body_clob(:body));
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'hr/:id', p_method => 'PUT',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'hr/:id', p_method => 'DELETE',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_hr.delete_row(:id);
  pkg_api.json_out(TO_CLOB('{"success":true}'));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'hr/:id', p_method => 'DELETE',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'hr/:id/verifiers');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'hr/:id/verifiers', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  IF pkg_hr.get_scoped(:id, pkg_auth.g_user_type, pkg_auth.g_linked_id) IS NULL THEN
    :status_code := 403; pkg_api.error_out('Access denied'); RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_hr.verifiers_json(:id)));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'hr/:id/verifiers', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'verify');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'verify', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_body CLOB;
  l_json JSON_OBJECT_T;
  l_row CLOB;
  l_code NUMBER;
BEGIN
  -- Authentication is optional for public certificate verification.
  l_code := pkg_auth.guard(:auth_token, NULL);
  l_body := pkg_api.body_clob(:body);
  IF l_body IS NULL THEN
    :status_code := 400;
    pkg_api.error_out('Request body is empty');
    RETURN;
  END IF;
  l_json := JSON_OBJECT_T.parse(l_body);
  IF l_json.get_string('reference') IS NULL THEN
    :status_code := 400;
    pkg_api.error_out('Certificate reference is required');
    RETURN;
  END IF;
  l_row := pkg_verification.verify(
    l_json.get_string('reference'),
    NVL(l_json.get_string('method'), 'MANUAL'),
    CASE WHEN pkg_auth.g_user_type = 'VERIFIER' THEN pkg_auth.g_linked_id END,
    NVL(:xff, OWA_UTIL.GET_CGI_ENV('REMOTE_ADDR')),
    :ua);
  pkg_api.json_out(l_row);
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'verify', p_method => 'POST',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'verify', p_method => 'POST',
    p_name => 'User-Agent', p_bind_variable_name => 'ua', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'verify', p_method => 'POST',
    p_name => 'X-Forwarded-For', p_bind_variable_name => 'xff', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'verifications');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'verifications', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_verification.list_json(pkg_auth.g_user_type, pkg_auth.g_linked_id)));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'verifications', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'verifications/:id');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'verifications/:id', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN,HR,VERIFIER');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  l_row := pkg_verification.get_scoped(:id, pkg_auth.g_user_type, pkg_auth.g_linked_id);
  IF l_row IS NULL THEN :status_code := 404; pkg_api.error_out('Not found'); RETURN; END IF;
  pkg_api.json_out(pkg_api.ok(l_row));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'verifications/:id', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'dashboard/stats');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'dashboard/stats', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_dashboard.stats_json));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'dashboard/stats', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'dashboard/certificates');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'dashboard/certificates', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_dashboard.certificates_json));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'dashboard/certificates', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'dcvs.api', p_pattern => 'dashboard/verifications');
END;
/

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'dcvs.api', p_pattern => 'dashboard/verifications', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql, p_items_per_page => 0,
    p_source => q'~DECLARE
  l_code NUMBER;
  l_row  CLOB;
BEGIN
  l_code := pkg_auth.guard(:auth_token, 'ADMIN');
  IF l_code <> 200 THEN
    :status_code := l_code;
    pkg_api.error_out(CASE l_code WHEN 401 THEN 'Authentication required' ELSE 'Access denied for your role' END);
    RETURN;
  END IF;
  pkg_api.json_out(pkg_api.ok(pkg_dashboard.verifications_json));
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  :status_code := pkg_api.status_for(SQLCODE);
  pkg_api.error_out(pkg_api.clean_msg(SQLERRM));
END;~');
  ORDS.DEFINE_PARAMETER(p_module_name => 'dcvs.api', p_pattern => 'dashboard/verifications', p_method => 'GET',
    p_name => 'X-Auth-Token', p_bind_variable_name => 'auth_token', p_source_type => 'HEADER', p_param_type => 'STRING', p_access_method => 'IN');
END;
/

COMMIT;
