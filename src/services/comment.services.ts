import prisma from '@src/libs/prisma';

class CommentServices {
  public async findAll() {
    return await prisma.comment.findMany({});
  }

  public async findByStuffId(stuffId: string) {
    const results = await prisma.comment.findMany({
      where: {
        stuff_id: stuffId,
      },
      include: {
        author: true,
        parent: true,
        stuff: true,
      },
    });

    return results;
  }

  public async find({ stuffId }: { stuffId?: string }) {
    const results = await prisma.comment.findMany({
      include: {
        author: true,
        parent: true,
        stuff: true,
      },
    });

    return results;
  }
}

export default new CommentServices();
