import {Entity, PrimaryGeneratedColumn, Column, BaseEntity} from "typeorm";
import { ObjectType, Field, Int } from "type-graphql";

@ObjectType() //this will let us use typeorm type as graphql type
@Entity("users")
export class User extends BaseEntity{
    @Field(() => Int)
    @PrimaryGeneratedColumn()
    id: number;

    @Field()
    @Column("text")
    email: string;

    @Column("text")
    password: string;

    @Column("int", {default: 0})
    tokenVersion: number;

    @Column("text", {default: ""})
    stripeCustomerId: string;

}
