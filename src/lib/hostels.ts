/**
 * IIT Bombay hostel list for the dropdown selector.
 * Includes all student hostels, Tansa, QIP, and faculty options.
 */
export const IIT_BOMBAY_HOSTELS = [
    'Hostel 1',
    'Hostel 2',
    'Hostel 3',
    'Hostel 4',
    'Hostel 5',
    'Hostel 6',
    'Hostel 7',
    'Hostel 8',
    'Hostel 9',
    'Hostel 10',
    'Hostel 11',
    'Hostel 12',
    'Hostel 13',
    'Hostel 14',
    'Hostel 15',
    'Hostel 16',
    'Hostel 17',
    'Hostel 18',
    'Tansa',
    'QIP Hostel',
    'Faculty Quarters',
    'Staff Quarters',
] as const;

export type IITBombayHostel = (typeof IIT_BOMBAY_HOSTELS)[number];
