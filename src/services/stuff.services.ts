import prisma from '@src/libs/prisma';
import { FileService } from './file.services';

const fileService = new FileService();

export const ruleReturnAuthorInfo = {
  select: {
    id: true,
    information: {
      select: {
        full_name: true,
        avatar_url: true,
      },
    },
  },
};

// interface StuffWithScore extends Stuff {
//   _score: number;
// }

export interface StuffInput {
  author_id: string;
  name: string;
  type: string;
  description: string;
  category: string;
  condition: number;
  custom_fields: {
    price?: number;
    step?: number;
    initial_price?: number;
    duration?: number;
  };
  payment_type: string;
  media?: File[];
  tags: { tag_slug: string; value: string }[];
}

export interface UpdateStuffInput {
  stuff_id: string;
  author_id: string;
  name?: string;
  type?: string;
  description?: string;
  category?: string;
  condition?: number;
  custom_fields: {
    price?: number;
    step?: number;
    initial_price?: number;
    duration?: number;
  };
  payment_type?: string;
  media?: File[];
  delete_media?: string[];
  tags?: { tag_slug: string; value: string }[];
  update_at: Date;
}

class StuffServices {
  public async findByUid(uid: string) {
    return await prisma.stuff.findMany({
      where: {
        author: {
          id: uid,
        },
        status: 1,
      },
      orderBy: {
        update_at: 'desc',
      },
      include: {
        category: true,
        tags: true,
        type: true,
        payment_type: true,
        auction: true,
      },
    });
  }

  public async findAll() {
    const result = await prisma.stuff.findMany({
      orderBy: {
        update_at: 'desc',
      },
      where: {
        type: {
          slug: {
            not: 'archived',
          },
        },
      },
      include: {
        author: ruleReturnAuthorInfo,
        category: true,
        tags: true,
        type: true,
        payment_type: true,
        auction: true,
      },
    });

    return result;
  }

  public async createStuff(input: StuffInput) {
    const file = input.media;
    const fileUrls = [];

    try {
      const transaction = await prisma.$transaction(async (prisma) => {
        if (file && file.length > 0) {
          const uploadPromises = file.map(async (uploadedFile: File) => {
            const downloadUrl = await fileService.uploadFileToFirebase(uploadedFile, 'test');
            fileUrls.push(downloadUrl);
          });

          await Promise.all(uploadPromises);
        }

        const createStuffSchema = {
          name: input.name,
          description: input.description,
          category: { connect: { slug: input.category } },
          type: { connect: { slug: input.type } },
          condition: input.condition,
          media: fileUrls,
          payment_type: {
            connect: {
              slug: input.payment_type,
            },
          },
          author: { connect: { id: input.author_id } },
          tags: {},
          price: input?.custom_fields?.price,
          auction: {},
        };

        if (input.type === 'auction') {
          createStuffSchema.auction = {
            create: {
              initial_price: input.custom_fields.price,
              step_price: input.custom_fields.step,
            },
          };
        }

        if (input.tags && input.tags.length > 0) {
          createStuffSchema.tags = {
            createMany: {
              data: input.tags,
            },
          };
        }

        const createdStuff = await prisma.stuff.create({
          data: {
            ...createStuffSchema,
          },
          include: {
            author: {
              ...ruleReturnAuthorInfo,
            },
            category: true,
            type: true,
            auction: true,
            payment_type: true,
            tags: true,
          },
        });

        return createdStuff;
      });

      return transaction;
    } catch (error) {
      console.error('Error creating stuff:', error);

      const removePromises = fileUrls.map(async (downloadUrl) => {
        await fileService.removeFileFromFirebase(downloadUrl);
      });

      await Promise.all(removePromises);

      throw new Error('Failed to create stuff. Files rolled back.');
    }
  }

  public async findSaleStuff() {
    const result = await prisma.stuff.findMany({
      where: {
        type: {
          name: 'Market',
        },
      },
      include: {
        author: {
          ...ruleReturnAuthorInfo,
        },
        category: true,
        tags: true,
        type: true,
      },
    });

    return result;
  }

  public async findById(stuffId: string) {
    const result = await prisma.stuff.findUnique({
      where: {
        id: stuffId,
      },
      include: {
        author: ruleReturnAuthorInfo,
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        type: true,
      },
    });

    return result;
  }

  public async findByTypeSlug(typeSlug: string) {
    return await prisma.stuff.findMany({
      where: {
        type: {
          slug: typeSlug,
        },
      },
      include: {
        type: true,
        category: true,
        author: ruleReturnAuthorInfo,
      },
    });
  }

  public async findRelateStuff(stuffId: string) {
    const originStuff = await this.findById(stuffId);

    const result = await prisma.stuff.findMany({
      where: {
        OR: [
          { category_id: originStuff.category_id }, // Same category
          {
            tags: {
              some: {
                OR: [...originStuff.tags.map((tag) => ({ tag_slug: tag.tag_slug }))],
              },
            },
          },
          { condition: { gt: (originStuff.condition / 10) * 9 } }, //Condition kém hơn nhiều nhất 1/10
        ],
      },
      orderBy: {
        update_at: 'desc', // Nếu trùng độ liên quan thì sắp xếp theo ngày tạo mới nhất
      },
      include: {
        author: ruleReturnAuthorInfo,
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        type: true,
      },
    });

    const scores = result.map((stuff) => {
      let score = 0;
      if (stuff.category_id === originStuff.category_id) score += 2; // Cùng category
      const conditionDiff = stuff.condition - (originStuff.condition - 10);
      score += conditionDiff * 0.1; // Càng mới càng tốt

      // Có chung tag
      const commonTags = stuff.tags.filter((tag) =>
        originStuff.tags.some((originTag) => originTag === tag)
      );
      score += commonTags.length * 3;

      return score;
    });

    // Sort the result array based on the corresponding scores
    result.sort((a, b) => {
      const scoreA = scores[result.indexOf(a)];
      const scoreB = scores[result.indexOf(b)];
      return scoreB - scoreA;
    });

    return result.slice(0, 10);
  }

  public async searchByNameAndSlug(input) {
    const { slug, page = 1, limit = 9 } = input;
    const offset = (page - 1) * limit;
    const keywords: string[] = input.keywords.split(' '); //tách search string thành keyword

    const result = await prisma.stuff.findMany({
      where: {
        OR: keywords //lấy kq có chứa 1 trong các keyword
          .filter((keyword) => keyword !== '') //lọc keyword rỗng
          .map((keyword) => ({
            name: {
              contains: keyword,
            },
          })),
        type: {
          slug: slug,
        },
      },
      include: {
        type: true,
        category: true,
        author: ruleReturnAuthorInfo,
      },
      take: limit,
      skip: offset,
    });

    const total = result.length;
    const totalPages = Math.ceil(total / limit);

    return {
      result,
      totalPages,
    };
  }

  public async checkExchange(stuffId, suggestId) {
    const result = await prisma.exchange.findMany({
      where: {
        stuff_id: stuffId,
        suggest_stuff_id: suggestId,
      },
    });
    return result;
  }

  public async getExchangeSuggest(stuffId: string) {
    const result = await prisma.exchange.findMany({
      where: {
        stuff_id: stuffId,
      },
      include: {
        suggest_stuff: true,
        user: true,
      },
    });

    return result;
  }

  public async createQuicklyExchange(input) {
    const { stuffId, ...data } = input;
    const file = input.media;
    const fileUrls = [];

    try {
      const transaction = await prisma.$transaction(async (prisma) => {
        if (file && file.length > 0) {
          console.log('create file...');
          const uploadPromises = file.map(async (uploadedFile: File) => {
            const downloadUrl = await fileService.uploadFileToFirebase(uploadedFile, 'test');
            fileUrls.push(downloadUrl);
          });

          await Promise.all(uploadPromises);
        }

        const result = await prisma.exchange.create({
          data: {
            stuff_id: stuffId,
            user_id: data.user_id,
            name: data.name,
            description: data.description,
            media: data.media,
            condition: data.condition,
          },
        });

        return result;
      });
      return transaction;
    } catch (error) {
      console.error('Error creating stuff:', error);

      const removePromises = fileUrls.map(async (downloadUrl) => {
        await fileService.removeFileFromFirebase(downloadUrl);
      });

      await Promise.all(removePromises);

      throw new Error('Failed to create quick_exchange_stuff. Files rolled back.');
    }
  }

  public async createExchange(input) {
    const { stuffId, suggestId } = input;
    const suggestStuff = await this.findById(suggestId);
    if ((await this.checkExchange(stuffId, suggestId)).length !== 0)
      throw new Error('already added');

    const result = await prisma.exchange.create({
      data: {
        stuff_id: stuffId,
        suggest_stuff_id: suggestId,
        user_id: suggestStuff.author.id,
        name: suggestStuff.name,
        description: suggestStuff.description,
        media: suggestStuff.media,
        condition: suggestStuff.condition,
      },
      include: {
        suggest_stuff: true,
        user: true,
      },
    });

    return result;
  }

  public async removeExchange(exchangeId) {
    const result = await prisma.exchange.delete({
      where: {
        id: exchangeId,
      },
    });

    return result;
  }

  public async updateStuff(input: UpdateStuffInput) {
    const existingStuff = await prisma.stuff.findUnique({
      where: { id: input.stuff_id },
      include: {
        tags: true,
        type: true,
        category: true,
        author: ruleReturnAuthorInfo,
        payment_type: true,
        auction: true,
      },
    });

    const updateStuffSchema = {
      name: input.name ? input.name : existingStuff.name,
      description: input.description ? input.description : existingStuff.description,
      category: input.category
        ? { connect: { slug: input.category } }
        : { connect: { slug: existingStuff.category.slug } },
      type: input.type
        ? { connect: { slug: input.type } }
        : { connect: { slug: existingStuff.type.slug } },
      condition: input.condition ? input.condition : existingStuff.condition,
      media: [],
      payment_type: input.payment_type
        ? { connect: { slug: input.payment_type } }
        : { connect: { slug: existingStuff.payment_type.slug } },
      author: { connect: { id: input.author_id } },
      tags: {},
      price: input?.custom_fields?.price ? input?.custom_fields?.price : existingStuff.price,
      auction: {},
      update_at: new Date(),
    };

    if (!existingStuff) {
      throw new Error(`Stuff not found.`);
    }

    if (input.type === 'auction') {
      throw new Error('You cannot update once the auction has started');
    }

    const file = input.media;
    const fileUrls = [];
    const fileUpdated = [];

    try {
      existingStuff.media.map((media) => fileUrls.push(media));
      if (file && file.length > 0) {
        console.log('update file...');
        const uploadPromises = file.map(async (uploadedFile: File) => {
          const downloadUrl = await fileService.uploadFileToFirebase(uploadedFile, 'update');
          fileUrls.push(downloadUrl);
          fileUpdated.push(downloadUrl);
        });

        await Promise.all(uploadPromises);
        updateStuffSchema.media = fileUrls;
      }

      if (input.delete_media && input.delete_media.length > 0) {
        console.log('delete url...');
        const updatedFileUrls = fileUrls.filter((url) => !input.delete_media.includes(url));
        updateStuffSchema.media = updatedFileUrls;
      }

      if (updateStuffSchema.media.length === 0) {
        updateStuffSchema.media = existingStuff.media;
      }

      const transaction = await prisma.$transaction(async (prisma) => {
        if (input.tags && input.tags.length > 0) {
          if (existingStuff && existingStuff.tags.length > 0) {
            const existingTagsFilter = existingStuff.tags
              .map((existingTag) => {
                const isCorrespondingInputTag = input.tags.some(
                  (tag) => tag.tag_slug === existingTag.tag_slug
                );
                return isCorrespondingInputTag ? null : existingTag;
              })
              .filter((tag) => tag !== null);

            const updatedTags = input.tags.map((inputTag) => {
              const correspondingExistingTag = existingStuff.tags.find(
                (existingTag) => existingTag.tag_slug === inputTag.tag_slug
              );
              return correspondingExistingTag
                ? { ...correspondingExistingTag, value: inputTag.value }
                : inputTag;
            });

            const newTags = input.tags
              .map((tag) => {
                const isTagNew = existingStuff.tags.some(
                  (existingTag) => existingTag.tag_slug === tag.tag_slug
                );
                return isTagNew ? null : tag;
              })
              .filter((tag) => tag !== null);

            if (updatedTags && updatedTags.length > 0) {
              updateStuffSchema.tags = {
                update: updatedTags.map((tag) => ({
                  where: { id: tag['id'] },
                  data: { value: tag.value },
                })),
              };
            }

            if (existingTagsFilter && existingTagsFilter.length > 0) {
              updateStuffSchema.tags = {
                deleteMany: {
                  tag_slug: {
                    in: existingTagsFilter.map((existingTag) => existingTag.tag_slug),
                  },
                },
              };
            }

            if (newTags && newTags.length > 0) {
              updateStuffSchema.tags = {
                createMany: {
                  data: newTags,
                },
              };
            }
          } else {
            updateStuffSchema.tags = {
              createMany: {
                data: input.tags,
              },
            };
          }
        }

        const updatedStuff = await prisma.stuff.update({
          where: {
            id: input.stuff_id,
          },
          data: {
            ...updateStuffSchema,
          },
          include: {
            author: {
              ...ruleReturnAuthorInfo,
            },
            category: true,
            type: true,
            auction: true,
            payment_type: true,
            tags: true,
          },
        });

        return updatedStuff;
      });

      if (input.delete_media && input.delete_media.length > 0) {
        console.log('delete file...');
        const deleteUrls = input.delete_media;
        const removeFileFromFirebase = deleteUrls.map(async (deleteUrl: string) => {
          await fileService.removeFileFromFirebase(deleteUrl);
        });

        await Promise.all(removeFileFromFirebase);
      }

      return transaction;
    } catch (error) {
      console.error('Error updating stuff:', error);

      const removePromises = fileUpdated.map(async (downloadUrl) => {
        await fileService.removeFileFromFirebase(downloadUrl);
      });

      await Promise.all(removePromises);

      throw new Error('Failed to update stuff. Files rolled back.');
    }
  }

  public async deleteStuff(stuffId: string) {
    const result = await prisma.stuff.update({
      where: {
        id: stuffId,
      },
      data: {
        status: 0,
      },
      select: {
        id: true,
      },
    });

    return 'Delete successfully';
  }
}

export default new StuffServices();
