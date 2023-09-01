use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::env;
use std::sync::Arc;
use tokio::sync::{ mpsc, Mutex };
use log;
use env_logger;

use log::{ info, debug, warn, error };

// mod domain;
mod check_installed_programs;
mod env_vars_checker;
mod mongo;
mod openai;
mod receive_send;
mod settings;
mod sqlite_helper_functions;
mod utils;
mod websocket;

#[allow(non_snake_case)]
pub mod generated_types {
    include!(concat!(env!("OUT_DIR"), "/skynet.types.rs"));
}

use crate::receive_send::start_message_sending_loop;
use crate::websocket::start_websocket_server;

// use bollard::container::{CreateExecOptions, StartExecResults};

#[tokio::main]
async fn main() {
    env_logger::init();

    // Check that the environmental variables are set:
    let file_location = "./req_env_vars.txt";
    match env_vars_checker::check_env_vars(file_location) {
        Ok(_) => println!("Checked all environment variables."),
        Err(e) => {
            eprintln!("Error: {}", e);
            panic!("env variables not set");
        }
    }

    // assert check required installed programs
    assert!(check_installed_programs::check_all_programs().is_ok());

    // Setup the db:
    match sqlite_helper_functions::setup_sqlite_db() {
        Ok(_) => {
            println!("sqlite working.. Tables are setup!");
        }
        Err(err) => {
            panic!("Oh goodness... {:?}", err);
        }
    }

    let key = "SQLITE_FILE_LOCATION";
    let sqlite_location = env::var(key).unwrap();

    let manager = SqliteConnectionManager::file(sqlite_location);
    let pool = match Pool::new(manager) {
        Ok(p) => p,
        Err(err) => {
            panic!("Failed to create SQLite connection pool: {:?}", err);
        }
    };

    let (tx, rx) = mpsc::unbounded_channel();
    let rx = Arc::new(Mutex::new(rx));

    let (client_tx, client_rx) = mpsc::channel(100);

    // Spawn the WebSocket server task
    let server_task = tokio::spawn(async move {
        start_websocket_server(rx.clone(), client_tx).await;
    });

    let arc_pool = Arc::new(pool.clone());

    // Spawn the message sender task
    let sender_task = tokio::spawn(async move {
        start_message_sending_loop(tx, client_rx, arc_pool).await;
    });

    // Wait for both tasks to complete
    match tokio::join!(server_task, sender_task) {
        (Ok(_), Ok(_)) => {}
        (Err(e), _) => {
            println!("Error in server task: {:?}", e);
        }
        (_, Err(e)) => {
            println!("Error in sender task: {:?}", e);
        }
    }
}
