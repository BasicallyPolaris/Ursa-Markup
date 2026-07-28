use base64::Engine;
use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_STDIN_IMAGE_BYTES: u64 = 64 * 1024 * 1024;
const STAGED_FILE_PREFIX: &str = "stdin-";

static NEXT_FILE_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Copy)]
struct SupportedImageFormat {
    extension: &'static str,
    mime_type: &'static str,
}

#[derive(serde::Serialize)]
pub(crate) struct StdinImagePayload {
    pub(crate) data_base64: String,
    pub(crate) mime_type: String,
    pub(crate) file_name: String,
}

#[derive(serde::Serialize)]
pub(crate) struct StdinImageBatch {
    pub(crate) images: Vec<StdinImagePayload>,
    pub(crate) errors: Vec<String>,
}

pub(crate) struct StdinImageInbox {
    directory: PathBuf,
    access: Mutex<()>,
}

impl Default for StdinImageInbox {
    fn default() -> Self {
        let cache_directory = dirs::cache_dir().unwrap_or_else(std::env::temp_dir);
        Self::new(
            cache_directory
                .join("ursa-markup")
                .join("stdin-image-inbox"),
        )
    }
}

impl StdinImageInbox {
    pub(crate) fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            access: Mutex::new(()),
        }
    }

    pub(crate) fn stage(&self, reader: &mut impl Read) -> Result<PathBuf, String> {
        let bytes = read_image_bytes(reader)?;
        let format = supported_format(&bytes)?;
        ensure_inbox_directory(&self.directory)?;

        let unique_id = NEXT_FILE_ID.fetch_add(1, Ordering::Relaxed);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let base_name = format!(
            "{STAGED_FILE_PREFIX}{}-{timestamp}-{unique_id}",
            std::process::id()
        );
        let partial_path = self.directory.join(format!("{base_name}.part"));
        let final_path = self
            .directory
            .join(format!("{base_name}.{}", format.extension));

        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }

        let mut file = options
            .open(&partial_path)
            .map_err(|error| format!("Could not stage the piped image: {error}"))?;
        if let Err(error) = file.write_all(&bytes).and_then(|_| file.flush()) {
            drop(file);
            let _ = fs::remove_file(&partial_path);
            return Err(format!("Could not stage the piped image: {error}"));
        }
        drop(file);

        if let Err(error) = fs::rename(&partial_path, &final_path) {
            let _ = fs::remove_file(&partial_path);
            return Err(format!("Could not finish staging the piped image: {error}"));
        }

        Ok(final_path)
    }

    pub(crate) fn take_pending(&self) -> StdinImageBatch {
        let _guard = self
            .access
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut batch = StdinImageBatch {
            images: Vec::new(),
            errors: Vec::new(),
        };

        if let Err(error) = ensure_inbox_directory(&self.directory) {
            batch.errors.push(error);
            return batch;
        }

        let entries = match fs::read_dir(&self.directory) {
            Ok(entries) => entries,
            Err(error) => {
                batch
                    .errors
                    .push(format!("Could not inspect piped images: {error}"));
                return batch;
            }
        };

        let mut staged_paths: Vec<PathBuf> = entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| is_staged_image_path(path))
            .collect();
        staged_paths.sort();

        for path in staged_paths {
            match consume_staged_image(&path) {
                Ok(image) => batch.images.push(image),
                Err(error) => batch.errors.push(error),
            }
            if let Err(error) = fs::remove_file(&path) {
                batch.errors.push(format!(
                    "Could not remove consumed piped image {}: {error}",
                    path.display()
                ));
            }
        }

        batch
    }
}

pub(crate) fn stdin_requested<T: AsRef<OsStr>>(args: &[T]) -> bool {
    args.iter().skip(1).any(|arg| {
        let arg = arg.as_ref();
        arg == OsStr::new("--stdin") || arg == OsStr::new("-")
    })
}

fn read_image_bytes(reader: &mut impl Read) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    reader
        .take(MAX_STDIN_IMAGE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read the piped image from stdin: {error}"))?;

    if bytes.len() as u64 > MAX_STDIN_IMAGE_BYTES {
        return Err(format!(
            "The piped image exceeds the {} MiB limit",
            MAX_STDIN_IMAGE_BYTES / 1024 / 1024
        ));
    }

    supported_format(&bytes)?;
    Ok(bytes)
}

fn supported_format(bytes: &[u8]) -> Result<SupportedImageFormat, String> {
    match image::guess_format(bytes) {
        Ok(image::ImageFormat::Png) => Ok(SupportedImageFormat {
            extension: "png",
            mime_type: "image/png",
        }),
        Ok(image::ImageFormat::Jpeg) => Ok(SupportedImageFormat {
            extension: "jpg",
            mime_type: "image/jpeg",
        }),
        Ok(image::ImageFormat::WebP) => Ok(SupportedImageFormat {
            extension: "webp",
            mime_type: "image/webp",
        }),
        Ok(image::ImageFormat::Gif) => Ok(SupportedImageFormat {
            extension: "gif",
            mime_type: "image/gif",
        }),
        Ok(image::ImageFormat::Bmp) => Ok(SupportedImageFormat {
            extension: "bmp",
            mime_type: "image/bmp",
        }),
        Ok(_) => Err("The piped data is not a supported image format".to_string()),
        Err(_) => Err("The piped data is not a recognized image".to_string()),
    }
}

fn ensure_inbox_directory(directory: &Path) -> Result<(), String> {
    if directory.exists() {
        let metadata = fs::symlink_metadata(directory)
            .map_err(|error| format!("Could not inspect the stdin image inbox: {error}"))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err("The stdin image inbox is not a safe directory".to_string());
        }
    } else {
        fs::create_dir_all(directory)
            .map_err(|error| format!("Could not create the stdin image inbox: {error}"))?;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(directory, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not secure the stdin image inbox: {error}"))?;
    }

    Ok(())
}

fn is_staged_image_path(path: &Path) -> bool {
    let Some(file_name) = path.file_name().and_then(OsStr::to_str) else {
        return false;
    };
    if !file_name.starts_with(STAGED_FILE_PREFIX) {
        return false;
    }

    matches!(
        path.extension().and_then(OsStr::to_str),
        Some("png" | "jpg" | "webp" | "gif" | "bmp")
    )
}

fn consume_staged_image(path: &Path) -> Result<StdinImagePayload, String> {
    let mut file =
        File::open(path).map_err(|error| format!("Could not open a piped image: {error}"))?;
    let bytes = read_image_bytes(&mut file)?;
    let format = supported_format(&bytes)?;

    Ok(StdinImagePayload {
        data_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
        mime_type: format.mime_type.to_string(),
        file_name: format!("Piped Image.{}", format.extension),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;
    use std::fs;

    fn args(values: &[&str]) -> Vec<OsString> {
        values.iter().map(OsString::from).collect()
    }

    const PNG_BYTES: &[u8] = include_bytes!("../icons/32x32.png");

    #[test]
    fn stdin_can_be_requested_with_long_flag() {
        assert!(stdin_requested(&args(&["ursamarkup", "--stdin"])));
    }

    #[test]
    fn stdin_can_be_requested_with_dash_positional() {
        assert!(stdin_requested(&args(&["ursamarkup", "-"])));
    }

    #[test]
    fn ordinary_file_paths_do_not_request_stdin() {
        assert!(!stdin_requested(&args(&["ursamarkup", "screenshot.png",])));
    }

    #[test]
    fn staged_png_is_returned_as_a_named_pathless_image_and_removed() {
        let directory = tempfile::tempdir().unwrap();
        let inbox = StdinImageInbox::new(directory.path().to_path_buf());

        inbox.stage(&mut &PNG_BYTES[..]).unwrap();
        let batch = inbox.take_pending();

        assert!(batch.errors.is_empty());
        assert_eq!(batch.images.len(), 1);
        assert_eq!(batch.images[0].mime_type, "image/png");
        assert_eq!(batch.images[0].file_name, "Piped Image.png");
        assert_eq!(
            base64::engine::general_purpose::STANDARD
                .decode(&batch.images[0].data_base64)
                .unwrap(),
            PNG_BYTES,
        );
        assert!(fs::read_dir(directory.path()).unwrap().next().is_none());
    }

    #[test]
    fn non_image_stdin_is_rejected_without_staging_a_file() {
        let directory = tempfile::tempdir().unwrap();
        let inbox = StdinImageInbox::new(directory.path().to_path_buf());

        let error = inbox.stage(&mut &b"plain text"[..]).unwrap_err();

        assert_eq!(error, "The piped data is not a recognized image");
        assert!(fs::read_dir(directory.path()).unwrap().next().is_none());
    }
}
