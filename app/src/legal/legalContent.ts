// Legal document content for the Metabolic Nuclear Medicine Platform.
//
// IMPORTANT BEFORE SUBMISSION: Replace the two bracketed placeholders below
// ([YOUR NAME / ORGANIZATION] and [CONTACT EMAIL]) with real values. This
// content is accurate to the app's actual data practices as of the MVP +
// production hardening build, but is not a substitute for review by
// qualified legal counsel, especially before wide hospital deployment.

const ENTITY_NAME = "[Steve Greatness]";
const CONTACT_EMAIL = "[stevegts69@gmail.com]";
const LAST_UPDATED = "2026";

export const PRIVACY_POLICY = `Privacy Policy

Last updated: ${LAST_UPDATED}

This Privacy Policy describes how the Metabolic Nuclear Medicine Platform ("the App"), provided by ${ENTITY_NAME}, collects, uses, and protects information.

1. Who This App Is For
This App is intended for use by qualified healthcare professionals (physicians, radiologists, nuclear medicine physicists, and institution administrators) acting within their professional capacity at a registered healthcare institution. It is not intended for use directly by patients.

2. Information We Collect
Account information: name, email address, professional role, and institution affiliation, provided by you at signup.
Clinical record data: entered by physicians and other authorized staff, including patient identifiers (name, medical record number, date of birth, sex), cancer type and stage, imaging files, metabolic monitoring readings, and treatment records. This data belongs to and is controlled by the healthcare institution using the App, not by ${ENTITY_NAME}.
Usage and technical data: audit logs of access to clinical records (who viewed or modified what, and when), and error/crash reports used to identify and fix technical problems. Error reports are configured to exclude patient-identifying information.

3. How We Use Information
To provide the App's core functionality: patient record-keeping, imaging storage, metabolic and treatment monitoring, and institution-wide coordination between authorized staff.
To maintain security and accountability, through audit logging and role-based access control.
To identify and fix technical problems, through error monitoring that is configured to exclude patient-identifying data.
We do not use clinical data for advertising, and we do not sell clinical data to third parties, including insurers, for any purpose.

4. How Information Is Stored and Protected
Data is stored using Supabase (PostgreSQL database, authentication, and file storage), with encryption in transit (TLS) and at rest.
Access to clinical records is restricted by institution: staff at one institution cannot view records belonging to another.
Every access and change to a patient record is logged in an audit trail, viewable only by institution administrators.
Access to the App itself is protected by device-level biometric or PIN authentication, in addition to account login.
Our data handling practices are designed in alignment with HIPAA and GDPR data-handling principles. This is a statement of design intent, not a certification of formal compliance or audit.

5. Who Can Access Your Data
Only staff at your own healthcare institution who have been verified by your institution's administrator can access your institution's clinical records. ${ENTITY_NAME} does not access clinical record content except as necessary to provide technical support or comply with legal obligations.

6. Data Retention
Clinical records are retained for as long as your institution continues using the App, consistent with standard medical record-keeping practice. Institutions may request deletion of their data by contacting us at the address below.

7. Your Rights
Depending on your location and applicable law (including Kenya's Data Protection Act 2023 and, where applicable, GDPR), you may have rights to access, correct, or request deletion of personal data associated with your account. Contact us using the details below to make such a request.

8. Changes to This Policy
We may update this Privacy Policy as the App evolves. Material changes will be reflected in the "Last updated" date above.

9. Contact
For privacy questions or data requests, contact: ${CONTACT_EMAIL}`;

export const TERMS_OF_SERVICE = `Terms of Service

Last updated: ${LAST_UPDATED}

These Terms of Service ("Terms") govern your use of the Metabolic Nuclear Medicine Platform ("the App"), provided by ${ENTITY_NAME}.

1. Eligibility
The App is intended solely for use by qualified healthcare professionals acting within their professional scope, affiliated with a registered healthcare institution. By creating an account, you confirm that you meet this requirement and that any professional credentials you provide are accurate.

2. What This App Is — and Is Not
The App is a clinical record-keeping and monitoring support tool. It is not a diagnostic device. It does not diagnose medical conditions, calculate radiopharmaceutical doses, or recommend treatment. All clinical decisions remain the sole responsibility of the treating physician, based on their own training, judgment, and their institution's own clinical processes. The App does not replace consultation with qualified medical professionals or your institution's standard of care.

3. Account Responsibilities
You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. New accounts require approval from your institution's administrator before gaining write access to clinical records. You agree to enter only accurate information and to use the App only for legitimate clinical record-keeping within your institution's own patient consent and data-handling processes.

4. Prohibited Uses
You agree not to: share your account credentials with others; access or attempt to access records belonging to an institution you are not authorized to work with; use the App to store or process data outside the scope of legitimate clinical care; or attempt to circumvent the App's security, audit, or access-control features.

5. Institution Responsibility for Patient Consent
${ENTITY_NAME} does not manage or verify patient consent for data entered into the App. It is the responsibility of the healthcare institution and treating physician to ensure appropriate patient consent exists under their own applicable laws and institutional policy.

6. No Warranty
The App is provided "as is" and "as available." While we work to keep the App reliable and secure, we do not warrant that it will be uninterrupted, error-free, or fit for any specific clinical outcome. Clinical judgment always takes precedence over anything displayed in the App.

7. Limitation of Liability
To the maximum extent permitted by applicable law, ${ENTITY_NAME} is not liable for any clinical decision made using information recorded in the App, or for indirect, incidental, or consequential damages arising from use of the App.

8. Termination
We may suspend or terminate access for accounts that violate these Terms, including unauthorized access attempts or misuse of patient data.

9. Governing Law
These Terms are governed by the laws of Kenya, without regard to conflict-of-law principles, except where mandatorily overridden by the laws of the jurisdiction in which a given institution operates.

10. Changes to These Terms
We may update these Terms as the App evolves. Continued use of the App after changes constitutes acceptance of the updated Terms.

11. Contact
Questions about these Terms: ${CONTACT_EMAIL}`;