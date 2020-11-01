import {Resolver, Query, Mutation, Arg, ObjectType, Field, Ctx, UseMiddleware, Int} from 'type-graphql';
import { User } from './entity/User';
import { hash, verify } from 'argon2';
import { MyContext } from './MyContext';
import { createRefreshToken, createAccessToken } from './auth/auth';
import { isAuth } from './auth/isAuthMiddleware';
import { sendRefreshToken } from './auth/sendRefreshToken';
import { getConnection } from 'typeorm';
import {Stripe} from 'stripe';

// Access Stripe
const stripe = require('stripe')('sk_test_51HJRmJAPO9Vmug8c4IxmkWXss81GCNgBnNhMVUc9wZA8njGfeM8DyaDFy0PoE0vBMkerCePSsvjMDSYbGTcCsxsd00marxhqWQ');

@ObjectType()
class LoginResponse {
	@Field()
	accessToken: string
	@Field(() => User)
	user: User;
}

@Resolver()
export class UserResolver {
	@Query(() => String)
	hello() {
		return 'hi!'
	}

	@Query(() => String)
	@UseMiddleware(isAuth)
	bye(@Ctx() { payload }: MyContext) {
		console.log(payload);
		return `your user id is: ${payload!.userId}`;
	}

	@Query(() => [User])
	users() {
		return User.find()
	}

	@Query(() => User, {nullable: true})
	me(
		@Ctx() context: MyContext
	) {
		const authorization = context.req.headers['authorization'];

		if (!authorization) {
			return null;
		}

		try {
			const token = authorization.split(" ")[1]
			const payload: any = verify(token, process.env.ACCESS_TOKEN_SECRET!)
			context.payload = payload as any;
			return User.findOne(payload.userId);
		} catch (err) {
			console.log(err);
			return null;
		}
	}

	// get a stripe checkout session
	@Query(() => stripe.Customer)
	// @UseMiddleware(isAuth)
	
	async createCustomer(
		@Ctx() { payload }: MyContext
	) {
		const user = await User.findOne(payload!.userId);

		if (!user) {
			throw new Error ("Need to be signed in!"); 
		}

		const customer = await stripe.customers.create({
			email: user.email,
		});

		user.stripeCustomerId = customer.id;
		await getConnection().getRepository(User).save(user);

		return customer.id;
	}


	// change this later into a function for password reset etc
	@Mutation(() => Boolean) 
	async revokeRefreshTokensForUser(
		@Arg('userId', () => Int) userId: number
	) {
		await getConnection().getRepository(User).increment({ id: userId}, "tokenVersion", 1);

		return true;
	}

	@Mutation(() => Boolean)
	async register(
		@Arg('email', () => String) email: string,
		@Arg('password', () => String) password: string
	) {
		const hashedPassword = await hash(password);

		try{
			// check if username already in use
			const user = await User.findOne({ where: { email } });
			if (user) {
				throw new Error ('Email already in use!');
			}

			await User.insert({
				email,
				password: hashedPassword
			});
		} catch (err) {
			console.log(err);
			return false;
		}

		return true;
	}

	@Mutation(() => LoginResponse)
	async login(
		@Arg('email', () => String) email: string,
		@Arg('password', () => String) password: string,
		@Ctx() {res}: MyContext
	): Promise<LoginResponse> {
		const user = await User.findOne({ where: { email } });

		if (!user) {
			throw new Error ('Invalid Login');
		}

		const valid = await verify(user.password, password);

		if (!valid) {
			throw new Error("Invalid Login");
		}

		// successful login
		sendRefreshToken(res, createRefreshToken(user));

		return {
			accessToken: createAccessToken(user),
			user
		}
	}

	@Mutation(() => Boolean) 
	async logout(@Ctx() {res}: MyContext) {
		sendRefreshToken(res, "");

		return true;
	}
}
