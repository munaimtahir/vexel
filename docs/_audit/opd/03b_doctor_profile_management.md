# OPD Doctor Profile Management

## API capabilities
- `GET /opd/doctors`, `GET /opd/doctors/{doctorId}`
- `POST /opd/doctors`
- `PATCH /opd/doctors/{doctorId}`

## Profile fields supported
- Full name (`displayName`)
- Specialty
- Designation/title
- Degrees/qualifications
- PMDC number
- PHC number
- Clinic name/address/phone
- Signature label/url metadata
- Active flag + sort order

## Admin UI updates
- OPD Doctors page now includes expanded create/edit fields for complete print identity.
- Active/inactive control retained.
- Doctor fields used directly in prescription payload mapping for doctor-driven header/footer identity.

## Boundary compliance
- Admin changes are config/reference only.
- Admin does not expose encounter workflow mutation commands.
