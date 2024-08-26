// mengimpor dotenv dan menjalankan konfigurasinya
require("dotenv").config();

const ClientError = require("./exceptions/ClientError");

const Hapi = require("@hapi/hapi");

const Jwt = require("@hapi/jwt");
// [delete old code] const routes = require('./routes');

// import nilai notes plugin dan NotesService
const notes = require("./api/notes");

// use db
const NotesService = require("./services/postgres/NotesService");
// const NotesService = require("./services/inMemory/NotesService");

// impor NotesValidator dari berkas src -> validator -> notes -> index.js
const NotesValidator = require("./validator/notes");

// users
const users = require("./api/users");
const UsersService = require("./services/postgres/UsersService");
const UsersValidator = require("./validator/users");

// authentications
const authentications = require("./api/authentications");
const AuthenticationsService = require("./services/postgres/AuthenticationsService");
const TokenManager = require("./tokenize/TokenManager");
const AuthenticationsValidator = require("./validator/authentications");

const init = async () => {
  // membuat instance dari NotesService
  const notesService = new NotesService();

  const usersService = new UsersService();
  const authenticationsService = new AuthenticationsService();

  const server = Hapi.server({
    // menggunakan config dari .env
    port: process.env.PORT,
    host: process.env.HOST,

    // port: 3000,
    // host: process.env.NODE_ENV !== "production" ? "localhost" : "0.0.0.0",
    routes: {
      cors: {
        origin: ["*"],
      },
    },
  });

  // [delete old code] server.route(routes);

  // registrasi plugin eksternal
  await server.register([
    {
      plugin: Jwt,
    },
  ]);

  // mendefinisikan strategy autentikasi jwt
  server.auth.strategy("notesapp_jwt", "jwt", {
    keys: process.env.ACCESS_TOKEN_KEY,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      maxAgeSec: process.env.ACCESS_TOKEN_AGE,
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: {
        id: artifacts.decoded.payload.id,
      },
    }),
  });

  // mendaftarkan plugin notes dengan options.service bernilai notesService
  await server.register([
    {
      plugin: notes,
      options: {
        service: notesService,
        validator: NotesValidator, // validator
      },
    },
    {
      plugin: users,
      options: {
        service: usersService,
        validator: UsersValidator,
      },
    },
    {
      plugin: authentications,
      options: {
        authenticationsService,
        usersService,
        tokenManager: TokenManager,
        validator: AuthenticationsValidator,
      },
    },
  ]);

  server.ext("onPreResponse", (request, h) => {
    // mendapatkan konteks response dari request
    const { response } = request;

    // penanganan client error secara internal.
    if (response instanceof ClientError) {
      // Jika error berasal dari instance ClientError,
      // response akan mengembalikan status fail, status code, dan message sesuai dengan errornya
      const newResponse = h.response({
        status: "fail",
        message: response.message,
      });
      newResponse.code(response.statusCode);
      return newResponse;
    }

    // Jika error bukan ClientError, kembalikan response apa adanya, biarlah Hapi yang menangani response secara default
    return h.continue;
  });

  await server.start();
  console.log(`Server berjalan pada ${server.info.uri}`);
};

init();
