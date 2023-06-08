import prisma from '@src/libs/prisma';

export const keyServices = {
  createKeyToken: async (
    userId: string,
    publicKey: string,
    privateKey: string,
    refreshToken: string
  ) => {
    const storedToken = await prisma.key.upsert({
      where: {
        user_id: userId,
      },
      create: {
        public_key: publicKey,
        private_key: privateKey,
        refresh_token: refreshToken,
        user: {
          connect: {
            id: userId,
          },
        },
      },
      update: {
        private_key: privateKey,
        public_key: publicKey,
        refresh_token: refreshToken,
      },
    });
    return storedToken ? storedToken : null;
  },
  findByUserId: async (uid: string): Promise<any> => {
    return prisma.key.findUnique({
      where: {
        user_id: uid,
      },
    });
  },
};
