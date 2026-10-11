-- Contact email entered at signup (optional). Students: the guardian's email.
-- Not the login: user_credentials.email is the internal "<loginId>@itgotalk.local" address.
alter table profiles add column contact_email text;
