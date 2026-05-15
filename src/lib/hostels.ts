/**
 * IIM Mumbai hostel list for the dropdown selector.
 * Formerly NITIE, based in Powai.
 */
export const IIM_MUMBAI_HOSTELS = [
    'Gilbreth Hostel',
    'Taylor Hostel',
    'Gantt Hostel',
    'New Hostel',
    'MD-1',
    'MD-2',
    'MD-3',
    'MDP Hostel',
    'Hostel 1',
    'Hostel 2',
    'Hostel 3',
    'Old Hostel',
    'Faculty Housing',
    'Staff Quarters',
] as const;

export type IIMMumbaiHostel = (typeof IIM_MUMBAI_HOSTELS)[number];
