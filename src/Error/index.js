const ExtendableError = require('./ExtendableError');

class WatchError extends ExtendableError {}
class AlreadyInitializedError extends ExtendableError {}
class NotInitializedError extends ExtendableError {}
class InvalidDataError extends ExtendableError {}


module.exports = {
    WatchError,
    AlreadyInitializedError,
    NotInitializedError,
    InvalidDataError
};
