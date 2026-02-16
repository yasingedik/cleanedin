export interface DonationOption {
  id: 'github_sponsors' | 'ko_fi';
  label: string;
  url: string;
  description: string;
  iconAlt: string;
}

const DONATION_OPTIONS: DonationOption[] = [
  {
    id: 'github_sponsors',
    label: 'GitHub Sponsors',
    url: 'https://github.com/sponsors/yasingedik',
    description: 'Recurring sponsorship managed through GitHub.',
    iconAlt: 'GitHub Sponsors'
  },
  {
    id: 'ko_fi',
    label: 'Ko-fi',
    url: 'https://ko-fi.com/yasingedik',
    description: 'One-time or recurring donations via Ko-fi.',
    iconAlt: 'Ko-fi'
  }
];

export function getConfiguredDonationOptions(): DonationOption[] {
  return DONATION_OPTIONS.filter((option) => option.url.trim().length > 0);
}
