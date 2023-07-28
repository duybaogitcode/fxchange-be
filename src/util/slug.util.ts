import slugify from 'slugify';

export function slugifyVi(value: string) {
  return slugify(value, { locale: 'vi', lower: true });
}
