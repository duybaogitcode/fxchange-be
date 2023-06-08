import { typeErrorMessages } from '@src/constants/errro-messages.constants';
import { BadRequestGraphQLError, GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';
import { slugifyVi } from '@src/util/slug.util';

class TypeService {
  public async create(name: string) {
    const generatedSlug = slugifyVi(name);

    const existType = await prisma.type.findFirst({
      where: {
        slug: generatedSlug,
        name: name,
      },
    });

    if (existType) throw new BadRequestGraphQLError(typeErrorMessages.exist);

    return await prisma.type.create({
      data: {
        name: name,
        slug: generatedSlug,
      },
    });
  }

  public async findAll() {
    return await prisma.type.findMany({});
  }

  public async findByID(id: string) {
    return await prisma.type.findUnique({
      where: {
        id: id,
      },
    });
  }

  public async findBySlug(slug: string) {
    const type = await prisma.type.findUnique({
      where: {
        slug: slug,
      },
    });

    if (!type) throw new GraphQLErrorResponse(typeErrorMessages.notFound);

    return type;
  }
}

export default new TypeService();
