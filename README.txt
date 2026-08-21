VELORRA HUB - PROJECT README (MERGED VERSION)


WHAT THIS IS

This is Velorra Hub as one single project: the storefront, the admin
panel, and the backend server are now all part of one folder and are
started with one command. You no longer need to run or deploy three
separate things.

There are two folders inside:

1. server - the backend. This is a Node.js program that stores your
   data (products, orders, categories, payment details, admin login)
   and, once built, also serves the actual website to visitors.

2. client - the website itself, containing both the storefront that
   customers see and the admin panel you use, in one project. This
   needs to be built once, and the result is placed automatically
   inside the server folder.

The admin panel is not a separate website anymore. It is reached by
clicking the "Admin" button at the bottom of the storefront's
navigation bar (or inside the menu on mobile), and is still protected
by its own username and password login.


HOW TO RUN IT

You will need Node.js installed on your computer (version 18 or newer).
Get it free from nodejs.org if you do not have it yet.

STEP 1 - Set up the server

1. Open a terminal inside the server folder.
2. Run: npm install
3. Copy the file named .env.example and rename the copy to .env
4. Open .env and set your own values, especially:
   - JWT_SECRET (any long random string)
   - ADMIN_USERNAME and ADMIN_PASSWORD (your login, used only the very
     first time the server starts)
   - SITE_URL (your website's real address, once you have one)

STEP 2 - Build the website

1. Open a terminal inside the client folder.
2. Open the file src/store/StoreApp.jsx and src/admin/AdminApp.jsx if
   you ever move the backend to a different address than the website
   itself. By default both already point to the same server
   automatically, so most people can skip this step entirely.
3. Run: npm install
4. Run: npm run build

This automatically places the finished website files inside
server/public. You do not need to move anything yourself.

STEP 3 - Start everything

1. Go back to the server folder.
2. Run: npm start

Your whole site, storefront and admin panel together, is now running
at http://localhost:4000

This works for testing on your own computer. For real customers to use
the site, the server folder needs to be deployed somewhere that stays
online, such as Render, Railway, or a private server. Wherever you
deploy it, remember to also run the client build step and make sure the
resulting server/public folder is included in what you deploy.


LOGGING INTO THE ADMIN PANEL

On the storefront, scroll to the bottom of the navigation bar (or open
the menu on mobile) and tap Admin. You will see a login box, with a red
warning underneath reminding visitors that this area is for admins
only.

Username and password are whatever you set as ADMIN_USERNAME and
ADMIN_PASSWORD in the server's .env file the first time it started.

You can change your username and password at any time from inside the
admin panel itself, under the Account section. That is the correct,
permanent way to update your login once the site is live.


ADDING YOUR FIRST PRODUCTS

The storefront starts completely empty on purpose. Nothing will appear
on your website until you add it yourself:

1. Log into the admin panel using the Admin button.
2. Go to Categories and create at least one category.
3. Go to Products and add your first product, assigning it to that
   category.

Once saved, it will appear automatically on the storefront.


SETTING YOUR PAYMENT DETAILS

In the admin panel, go to the Payment Account section and fill in your
account number, account name, and bank. These are exactly what customers
will see at checkout when they are told where to send payment.


HANDLING ORDERS

When a customer checks out, their order appears in the admin panel under
Pending Orders. Each order shows every product in it with its image,
price, colour, size, and quantity, along with the customer's delivery
address, phone number, WhatsApp number, amount paid, and their uploaded
payment receipt if they provided one.

Once you have confirmed payment and sent the order out, click the
Fulfilled button on that order. It will move into Order History.


MAKING CHANGES LATER

If you ever edit any of the code inside the client folder, you need to
run npm run build again inside that folder afterward, then restart the
server, for your changes to show up on the actual website.


IF SOMETHING IS NOT WORKING

Most problems come down to one of these:

- You skipped the build step, so the server has nothing to serve. Run
  npm run build inside the client folder, then restart the server.
- The server is not running at all. Run npm start inside the server
  folder.
- You changed something in the client folder but forgot to rebuild it
  afterward.

Checking these three things solves almost everything.
