-- 03_multivalued.sql : multivalued attributes Email / Phone

CREATE TABLE applicant_email (
  applicant_id NUMBER NOT NULL REFERENCES applicant(applicant_id) ON DELETE CASCADE,
  email        VARCHAR2(150) NOT NULL,
  CONSTRAINT pk_applicant_email PRIMARY KEY (applicant_id, email),
  CONSTRAINT ck_applicant_email CHECK (INSTR(email,'@') > 1)
);
CREATE TABLE applicant_phone (
  applicant_id NUMBER NOT NULL REFERENCES applicant(applicant_id) ON DELETE CASCADE,
  phone        VARCHAR2(20) NOT NULL,
  CONSTRAINT pk_applicant_phone PRIMARY KEY (applicant_id, phone)
);
CREATE TABLE verifier_email (
  verifier_id NUMBER NOT NULL REFERENCES verifier(verifier_id) ON DELETE CASCADE,
  email       VARCHAR2(150) NOT NULL,
  CONSTRAINT pk_verifier_email PRIMARY KEY (verifier_id, email),
  CONSTRAINT ck_verifier_email CHECK (INSTR(email,'@') > 1)
);
CREATE TABLE verifier_phone (
  verifier_id NUMBER NOT NULL REFERENCES verifier(verifier_id) ON DELETE CASCADE,
  phone       VARCHAR2(20) NOT NULL,
  CONSTRAINT pk_verifier_phone PRIMARY KEY (verifier_id, phone)
);
