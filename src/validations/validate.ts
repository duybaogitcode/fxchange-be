import { Client } from '@googlemaps/google-maps-services-js';

export async function validateAddress(address: string): Promise<boolean> {
  const client = new Client({});
  console.log(address);
  const response = await client.geocode({
    params: {
      address: address,
      components: 'country:VN',
      key: 'AIzaSyDIdK3RahYGwAhjJvzFiYOSDjkOmfNSbhw',
    },
    timeout: 5000,
  });

  if (response.data.results.length === 0) {
    console.log('No results found');
    return false;
  }
  const addressComponents = response.data.results[0].address_components;
  const formattedAddress = response.data.results[0].formatted_address;
  const addressWithoutCountry = formattedAddress.replace(/,\s*Vietnam$/, '');

  return isStringSimilar(address.toLowerCase(), addressWithoutCountry.toLowerCase());
}

function isStringSimilar(string1: string, string2: string): boolean {
  const distance = levenshteinDistance(string1, string2);
  const maxLength = Math.max(string1.length, string2.length);
  const similarity = 1 - distance / maxLength;
  return similarity >= 0.7;
}

function levenshteinDistance(string1: string, string2: string): number {
  const matrix = [];

  for (let i = 0; i <= string1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= string2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= string1.length; i++) {
    for (let j = 1; j <= string2.length; j++) {
      const cost = string1[i - 1] === string2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[string1.length][string2.length];
}

export function validatePhone(phone: string): boolean {
  const vnfRegex = /((09|03|07|08|05)+([0-9]{8})\b)/g;
  return vnfRegex.test(phone);
}

export function validateName(name: string): boolean {
  return /^[^0-9_!¡?÷?¿/\\+=@#$%ˆ&*(){}|~<>;:'[\]]{8,}$/.test(name);
}

export function validateAddressDetails(addressDetails: string): boolean {
  const regex = /^[a-zA-Z0-9\s/]{4,}$/;
  return regex.test(addressDetails);
}
