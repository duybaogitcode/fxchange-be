import prisma from '@src/libs/prisma';

class pointServices {
  public async createPointHistory(updatedPoint: number, content: string, userId: string) {
    const createPointH = await prisma.pointHistory.create({
      data: {
        change: updatedPoint,
        content: content,
        time: new Date(),
        user: { connect: { id: userId } },
      },
    });
    return createPointH;
  }

  public async getByUserId(userId: string) {
    return await prisma.pointHistory.findMany({
      where: {
        user_id: userId,
      },
    });
  }
}

export default new pointServices();
