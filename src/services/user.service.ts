import { GraphQLErrorResponse, BadRequestGraphQLError } from '@src/graphql/error';
import prisma from '@src/libs/prisma';
import { validatePhone, validateAddress, validateName } from '@src/validations/validate';

export interface userUpdateInput {
  id: string;
  information: {
    full_name: string;
    phone: string;
    address: string;
  };
  status?: number;
  point?: number;
  update_at?: Date;
}

class UserServices {
  public async getBySubId(sub: string) {
    const result = await prisma.user.findUnique({
      where: {
        id: sub,
      },
    });

    return result;
  }
  public async findAll() {
    const results = await prisma.user.findMany({
      include: {
        role: true,
      },
    });

    return results;
  }

  public async updateUser(input: userUpdateInput) {
    const existingUser = await prisma.user.findUnique({
      where: {
        id: input.id,
      },
    });

    if (!existingUser) {
      throw new GraphQLErrorResponse("Couldn't find user", 404, 'USER_NOT_FOUND');
    }

    const updateUserSchema = {
      information: existingUser.information,
      point: input.point ? input.point : existingUser.point,
      status: input.status ? input.status : existingUser.status,
      update_at: new Date(),
    };

    if (
      input.information &&
      input.information.full_name &&
      input.information.full_name.length > 0
    ) {
      if (!validateName(input.information.full_name)) {
        throw new GraphQLErrorResponse('Invalid name', 404, 'NAME_NOT_VALID');
      }
    }

    if (input.information && input.information.phone && input.information.phone.length > 0) {
      if (!validatePhone(input.information.phone)) {
        throw new GraphQLErrorResponse('Invalid phone number', 404, 'PHONE_NOT_VALID');
      }
      updateUserSchema.information.phone = input.information.phone;
    }

    if (input.information && input.information.address && input.information.address.length > 0) {
      const isCityInVietnam = await validateAddress(input.information.address);

      if (!isCityInVietnam) {
        throw new GraphQLErrorResponse('Invalid address', 404, 'ADDRESS_NOT_VALID');
      }

      updateUserSchema.information.address = input.information.address;
    }

    console.log(updateUserSchema);

    const updateUser = await prisma.user.update({
      where: {
        id: input.id,
      },
      data: {
        ...updateUserSchema,
      },
    });
    return updateUser;
  }
}

export default new UserServices();
