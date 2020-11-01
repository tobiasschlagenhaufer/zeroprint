import {Response} from 'express'

export const sendRefreshToken = (res: Response, token: string) => {
	res.cookie("jid", token, {
			httpOnly: true,
			path: "/refresh_token",
			expires: new Date(Date.now() + 604800000) //this is 7d in ms
		}
	);
}