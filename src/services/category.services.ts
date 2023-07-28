import { categoryErrorMessages } from '@src/constants/errro-messages.constants';
import { BadRequestGraphQLError, GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';
import { slugifyVi } from '@src/util/slug.util';

class CategoryServices {
  public async create(name: string) {
    const generatedSlug = slugifyVi(name);

    const existType = await prisma.category.findFirst({
      where: {
        slug: generatedSlug,
        name: name,
      },
    });

    if (existType) throw new BadRequestGraphQLError(categoryErrorMessages.exist(name));

    return await prisma.category.create({
      data: {
        name: name,
        slug: generatedSlug,
      },
    });
  }

  public async findAll() {
    return await prisma.category.findMany({});
  }

  public async findByID(id: string) {
    const type = await prisma.category.findUnique({
      where: {
        id: id,
      },
    });

    if (!type) throw new GraphQLErrorResponse(categoryErrorMessages.notFound);

    return type;
  }

  public async findBySlug(slug: string) {
    const category = await prisma.category.findUnique({
      where: {
        slug: slug,
      },
    });

    if (!category) throw new GraphQLErrorResponse(categoryErrorMessages.notFound);

    return category;
  }
}

export default new CategoryServices();
