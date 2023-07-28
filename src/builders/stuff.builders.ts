import { addDays } from 'date-fns';

import { Prisma } from '@prisma/client';

export interface StuffBasicInformation {
  author_id: string;
  name: string;
  type: string;
  description: string;
  category: string;
  condition: number;
  payment_type: string;
  media?: string[];
  custom_fields: {
    price?: number;
  };
  tags?: { tag_slug: string; value: string }[];
}

export interface AuctionStuffInput {
  step_price?: number;
  initial_price?: number;
  duration?: number;
  start_automatically?: boolean;
}

class StuffInputSchemaBuilders {
  private schema: Prisma.StuffCreateInput;

  public constructor(input: StuffBasicInformation) {
    this.schema = {
      name: input.name,
      description: input.description,
      category: { connect: { slug: input.category } },
      type: { connect: { slug: input.type } },
      condition: input.condition,
      media: input.media,
      payment_type: {
        connect: {
          slug: input.payment_type || 'point',
        },
      },
      author: { connect: { id: input.author_id } },
      tags: {},
      price: input.custom_fields.price,
      auction: {},
      transactions: {},
    };

    if (input.tags && input.tags.length > 0) {
      this.addTags(input.tags);
    }
  }

  public addCategory(categorySlug: string) {
    this.schema.category.connect = {
      slug: categorySlug,
    };

    return this;
  }

  public addType(typeSlug: string) {
    this.schema.type.connect = {
      slug: typeSlug,
    };

    return this;
  }

  public addTags(tags: { tag_slug: string; value: string }[]) {
    this.schema.tags = {
      createMany: {
        data: tags,
      },
    };

    return this;
  }

  public buildAuction(input: AuctionStuffInput) {
    this.schema.auction.create = {
      initial_price: input.initial_price,
      step_price: input.step_price,
      duration: input.duration,
      start_automatically: false,
    };
    this.schema.status = 0;

    // this.schema.transactions.create = {
    //   amount: input.initial_price,
    //   expire_at: addDays(new Date(), 3),
    //   is_pickup: true,
    //   stuff_owner: {
    //     connect: {
    //       id: this.schema.author.connect.id,
    //     },
    //   },
    // };
  }

  public build() {
    return this.schema;
  }
}

export default StuffInputSchemaBuilders;
