-- Mobile number entered at signup by staff (optional), digits only ('01012345678').
-- Students' numbers are their guardian's, kept in guardians.phone.
alter table profiles add column contact_phone text;
